import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Conversation, Customer, Prisma, Service } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantConfig } from '../tenants/tenants.service';
import {
  AppointmentStep,
  ConversationState,
  EngineResult,
  Intent,
} from '../common/types';
import { LLM_PROVIDER, LlmProvider } from '../llm/llm-provider.interface';
import { asLanguage, Language, t } from '../common/i18n/messages';
import { detectLanguage } from '../common/i18n/detect-language';
import { AppointmentsService } from '../appointments/appointments.service';
import { HandoffService } from '../handoff/handoff.service';
import { ConversationStateStore } from './conversation-state.store';
import { ConversationStateMachine } from './conversation-state.machine';
import { IntentClassifierService } from './intent-classifier.service';

const HISTORY_LIMIT = 10;

/**
 * Orchestrates a single inbound message end-to-end:
 *   persist inbound -> resolve tenant/customer/conversation -> decide reply
 *   (rules + state machine + AI) -> persist outbound -> return result.
 *
 * The caller (WhatsApp controller / simulation endpoint) is responsible for
 * actually delivering the returned reply through the WhatsApp client.
 */
@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stateStore: ConversationStateStore,
    private readonly stateMachine: ConversationStateMachine,
    private readonly classifier: IntentClassifierService,
    private readonly appointments: AppointmentsService,
    private readonly handoff: HandoffService,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
  ) {}

  async handleInboundMessage(
    tenant: TenantConfig,
    fromPhone: string,
    body: string,
    opts: { providerMessageId?: string } = {},
  ): Promise<EngineResult> {
    const customer = await this.upsertCustomer(tenant, fromPhone);
    const conversation = await this.getOrCreateConversation(tenant, customer);

    await this.persistMessage(
      conversation.id,
      'inbound',
      'customer',
      body,
      undefined,
      opts.providerMessageId,
    );

    // A human is handling this conversation — record the message but stay
    // silent until the handoff is resolved (see admin reopen endpoint).
    if (conversation.status === 'awaiting_human') {
      return { reply: '', intent: Intent.HumanRequested, silent: true };
    }

    const state = await this.loadState(tenant, fromPhone, conversation, customer);
    const result = await this.decide(tenant, customer, conversation, state, body);

    await this.persistMessage(
      conversation.id,
      'outbound',
      'assistant',
      result.reply,
      { intent: result.intent },
    );
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    return result;
  }

  /**
   * Resolves a handoff and returns the conversation to the bot: marks the
   * handoff resolved, sets the conversation back to active, and clears any
   * stale in-progress state so the next message starts fresh.
   */
  async resolveHandoff(handoffId: string): Promise<{ conversationId: string }> {
    const handoff = await this.prisma.handoffRequest.findUnique({
      where: { id: handoffId },
      include: {
        conversation: { include: { tenant: true, customer: true } },
      },
    });
    if (!handoff) {
      throw new NotFoundException(`Unknown handoff: ${handoffId}`);
    }

    await this.prisma.handoffRequest.update({
      where: { id: handoffId },
      data: { status: 'resolved' },
    });
    await this.prisma.conversation.update({
      where: { id: handoff.conversationId },
      data: { status: 'active' },
    });
    await this.stateStore.clear(
      handoff.conversation.tenant.slug,
      handoff.conversation.customer.phone,
    );

    return { conversationId: handoff.conversationId };
  }

  // --- core decision logic ------------------------------------------------

  private async decide(
    tenant: TenantConfig,
    customer: Customer,
    conversation: Conversation,
    state: ConversationState,
    body: string,
  ): Promise<EngineResult> {
    // Resolve the conversation language: lock it for an ongoing appointment to
    // avoid mid-flow switches; otherwise detect it from the message.
    const detected = detectLanguage(body, asLanguage(tenant.defaultLanguage));
    const lang: Language =
      state.flow === 'appointment' && state.language ? state.language : detected;
    state.language = lang;

    // Emergencies always short-circuit, regardless of the current flow.
    if (this.classifier.detectEmergency(tenant, body)) {
      return this.handleEmergency(tenant, customer, conversation, state, body);
    }

    if (state.flow === 'appointment') {
      return this.continueAppointment(tenant, customer, conversation, state, body);
    }

    return this.handleIdle(tenant, customer, conversation, state, body);
  }

  private async handleIdle(
    tenant: TenantConfig,
    customer: Customer,
    conversation: Conversation,
    state: ConversationState,
    body: string,
  ): Promise<EngineResult> {
    const history = await this.loadHistory(conversation.id);
    const classified = await this.classifier.classify(tenant, body, history);
    const m = t(asLanguage(state.language));

    switch (classified.intent) {
      case Intent.HumanRequested:
        return this.raiseHandoff(
          tenant,
          customer,
          conversation,
          state,
          body,
          'customer_requested_human',
          m.handoffHuman,
        );

      case Intent.Faq: {
        const faq = tenant.faqs.find((f) => f.id === classified.matchedFaqId);
        if (!faq) {
          return this.raiseHandoff(
            tenant,
            customer,
            conversation,
            state,
            body,
            'unhandled',
            m.faqFallback,
          );
        }
        // FAQ answers are configured per-tenant and returned as written.
        return { reply: faq.answer, intent: Intent.Faq };
      }

      case Intent.AppointmentRequest:
        return this.startAppointment(
          tenant,
          customer,
          conversation,
          state,
          body,
          classified.matchedServiceId,
        );

      case Intent.Greeting:
        return { reply: m.greeting, intent: Intent.Greeting };

      // Unknown / low-confidence -> route to a human, never guess.
      default:
        return this.raiseHandoff(
          tenant,
          customer,
          conversation,
          state,
          body,
          'low_confidence',
          m.handoffLowConfidence,
        );
    }
  }

  // --- appointment flow ---------------------------------------------------

  private async startAppointment(
    tenant: TenantConfig,
    customer: Customer,
    conversation: Conversation,
    state: ConversationState,
    body: string,
    matchedServiceId?: string,
  ): Promise<EngineResult> {
    const matched = matchedServiceId
      ? tenant.services.find((s) => s.id === matchedServiceId)
      : undefined;

    // Route non-lead_only services before collecting anything.
    if (matched) {
      const routed = await this.routeServiceFlow(
        tenant,
        customer,
        conversation,
        state,
        body,
        matched,
      );
      if (routed) return routed;
    }

    state.flow = 'appointment';
    state.step = AppointmentStep.Service;
    state.slots = { serviceName: matched?.name };

    return this.continueAppointment(tenant, customer, conversation, state, body);
  }

  private async continueAppointment(
    tenant: TenantConfig,
    customer: Customer,
    conversation: Conversation,
    state: ConversationState,
    body: string,
  ): Promise<EngineResult> {
    // Deterministic first: a configured service keyword resolves the service
    // slot without involving the LLM.
    if (!state.slots.serviceName) {
      const svc = this.classifier.matchService(tenant, body);
      if (svc) state.slots = this.mergeSlots(state.slots, { serviceName: svc.name });
    }

    // Let the LLM fill any remaining slots the customer just provided
    // (validated by Zod).
    const extracted = await this.llm.extractSlots({
      message: body,
      knownSlots: state.slots,
      serviceNames: tenant.services.map((s) => s.name),
    });
    state.slots = this.mergeSlots(state.slots, extracted);

    // Direct answer: whatever the customer just replied is taken as the answer
    // to the question we asked, so a bare reply ("Alejandro") advances the flow
    // even when no keyword/LLM extraction matched it.
    state.slots = this.captureDirectAnswer(state.step, state.slots, body, tenant);

    // If a service got resolved that isn't lead_only, branch out of collection.
    if (state.slots.serviceName) {
      const svc = this.resolveServiceByName(tenant, state.slots.serviceName);
      if (svc && svc.flow !== 'lead_only') {
        const routed = await this.routeServiceFlow(
          tenant,
          customer,
          conversation,
          state,
          body,
          svc,
        );
        if (routed) return routed;
      }
    }

    const step = this.stateMachine.nextStep(state.slots);

    if (step === AppointmentStep.Complete) {
      const appointment = await this.appointments.createFromSlots({
        tenant,
        conversationId: conversation.id,
        customerId: customer.id,
        customerPhone: customer.phone,
        slots: state.slots,
      });
      // Persist the collected name back onto the customer record.
      if (state.slots.customerName && !customer.name) {
        await this.prisma.customer.update({
          where: { id: customer.id },
          data: { name: state.slots.customerName },
        });
      }
      await this.stateStore.clear(tenant.slug, customer.phone);
      return {
        reply: this.stateMachine.completionMessage(
          state.slots,
          asLanguage(state.language),
        ),
        intent: Intent.AppointmentRequest,
        createdAppointmentId: appointment.id,
      };
    }

    state.step = step;
    await this.stateStore.save(tenant.slug, customer.phone, state);
    return {
      reply: this.stateMachine.promptFor(
        step,
        tenant,
        state.slots,
        asLanguage(state.language),
      ),
      intent: Intent.AppointmentRequest,
    };
  }

  /**
   * Handles services whose flow is not lead_only. Returns an EngineResult when
   * the service short-circuits collection, or null to continue lead_only.
   */
  private async routeServiceFlow(
    tenant: TenantConfig,
    customer: Customer,
    conversation: Conversation,
    state: ConversationState,
    body: string,
    service: Service,
  ): Promise<EngineResult | null> {
    const m = t(asLanguage(state.language));
    if (service.flow === 'external_link') {
      await this.stateStore.clear(tenant.slug, customer.phone);
      const link = service.bookingUrl
        ? m.externalLink(service.name, service.bookingUrl)
        : m.externalLinkNoUrl(service.name);
      return { reply: link, intent: Intent.AppointmentRequest };
    }

    if (service.flow === 'human_handoff') {
      return this.raiseHandoff(
        tenant,
        customer,
        conversation,
        state,
        body,
        'sensitive_case',
        m.handoffSensitive,
      );
    }

    return null;
  }

  // --- emergency & handoff ------------------------------------------------

  private async handleEmergency(
    tenant: TenantConfig,
    customer: Customer,
    conversation: Conversation,
    state: ConversationState,
    body: string,
  ): Promise<EngineResult> {
    const reply =
      tenant.emergencyMessage ?? t(asLanguage(state.language)).emergencyFallback;
    return this.raiseHandoff(
      tenant,
      customer,
      conversation,
      state,
      body,
      'emergency',
      reply,
    );
  }

  private async raiseHandoff(
    tenant: TenantConfig,
    customer: Customer,
    conversation: Conversation,
    state: ConversationState,
    body: string,
    reason:
      | 'emergency'
      | 'customer_requested_human'
      | 'low_confidence'
      | 'sensitive_case'
      | 'unhandled',
    reply: string,
  ): Promise<EngineResult> {
    const handoff = await this.handoff.create({
      tenant,
      conversationId: conversation.id,
      customerId: customer.id,
      customerPhone: customer.phone,
      reason,
      triggeringMessage: body,
    });
    await this.stateStore.clear(tenant.slug, customer.phone);
    return {
      reply,
      intent: reason === 'emergency' ? Intent.Emergency : Intent.HumanRequested,
      createdHandoffId: handoff.id,
    };
  }

  // --- helpers ------------------------------------------------------------

  /**
   * Treats the customer's reply as the direct answer to the slot we last asked
   * for, when that slot is still empty. This guarantees the appointment flow
   * progresses on plain replies (e.g. answering "What is your name?" with just
   * "Alejandro") regardless of keyword/LLM extraction.
   */
  private captureDirectAnswer(
    step: AppointmentStep | null,
    slots: ConversationState['slots'],
    message: string,
    tenant: TenantConfig,
  ): ConversationState['slots'] {
    const text = message.trim();
    if (!step || !text) return slots;

    switch (step) {
      case AppointmentStep.Service: {
        if (slots.serviceName) return slots;
        const svc = this.classifier.matchService(tenant, message);
        return svc ? this.mergeSlots(slots, { serviceName: svc.name }) : slots;
      }
      case AppointmentStep.CustomerName:
        if (slots.customerName) return slots;
        return this.mergeSlots(slots, { customerName: this.cleanName(text) });
      case AppointmentStep.PetName:
        if (slots.petName) return slots;
        return this.mergeSlots(slots, { petName: this.cleanName(text) });
      case AppointmentStep.PetType:
        if (slots.petType) return slots;
        return this.mergeSlots(slots, { petType: this.normalizePetType(text) });
      case AppointmentStep.PreferredTime:
        if (slots.preferredTime) return slots;
        return this.mergeSlots(slots, { preferredTime: text });
      default:
        return slots;
    }
  }

  /** Strips common lead-ins ("my name is X") and returns the bare value. */
  private cleanName(text: string): string {
    return text
      .replace(
        /^(?:my name is|my name's|i am|i'm|it's|soy|me llamo|mi nombre es)\s+/i,
        '',
      )
      .trim();
  }

  private normalizePetType(text: string): string {
    const t = text.toLowerCase();
    if (/\b(dog|perro|perra|puppy|cachorro)\b/.test(t)) return 'Dog';
    if (/\b(cat|gato|gata|kitten|gatito)\b/.test(t)) return 'Cat';
    return text.trim();
  }

  private mergeSlots(
    current: ConversationState['slots'],
    extracted: Record<string, string | null | undefined>,
  ): ConversationState['slots'] {
    const next = { ...current };
    for (const [k, v] of Object.entries(extracted)) {
      if (typeof v === 'string' && v.trim() && !next[k as keyof typeof next]) {
        (next as Record<string, unknown>)[k] = v.trim();
      }
    }
    return next;
  }

  private resolveServiceByName(
    tenant: TenantConfig,
    name: string,
  ): Service | undefined {
    const lower = name.toLowerCase();
    return tenant.services.find(
      (s) =>
        s.name.toLowerCase() === lower ||
        s.keywords.some((kw) => kw.toLowerCase() === lower),
    );
  }

  private async loadState(
    tenant: TenantConfig,
    phone: string,
    conversation: Conversation,
    customer: Customer,
  ): Promise<ConversationState> {
    const existing = await this.stateStore.get(tenant.slug, phone);
    if (existing) return existing;
    return {
      conversationId: conversation.id,
      customerId: customer.id,
      flow: 'idle',
      step: null,
      slots: {},
      updatedAt: new Date().toISOString(),
    };
  }

  private async loadHistory(
    conversationId: string,
  ): Promise<{ role: string; body: string }[]> {
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
    });
    return messages
      .reverse()
      .map((m) => ({ role: m.role, body: m.body }));
  }

  private async upsertCustomer(
    tenant: TenantConfig,
    phone: string,
  ): Promise<Customer> {
    return this.prisma.customer.upsert({
      where: { tenantId_phone: { tenantId: tenant.id, phone } },
      update: {},
      create: { tenantId: tenant.id, phone },
    });
  }

  private async getOrCreateConversation(
    tenant: TenantConfig,
    customer: Customer,
  ): Promise<Conversation> {
    const active = await this.prisma.conversation.findFirst({
      where: {
        tenantId: tenant.id,
        customerId: customer.id,
        status: { in: ['active', 'awaiting_human'] },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
    if (active) return active;

    return this.prisma.conversation.create({
      data: { tenantId: tenant.id, customerId: customer.id },
    });
  }

  private async persistMessage(
    conversationId: string,
    direction: 'inbound' | 'outbound',
    role: 'customer' | 'assistant' | 'system',
    body: string,
    metadata?: Record<string, unknown>,
    providerMessageId?: string,
  ): Promise<void> {
    await this.prisma.message.create({
      data: {
        conversationId,
        direction,
        role,
        body,
        providerMessageId: providerMessageId ?? null,
        metadata: metadata
          ? (metadata as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }
}
