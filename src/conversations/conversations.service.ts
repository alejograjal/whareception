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

    switch (classified.intent) {
      case Intent.HumanRequested:
        return this.raiseHandoff(
          tenant,
          customer,
          conversation,
          state,
          body,
          'customer_requested_human',
          'A team member will reach out to you shortly.',
        );

      case Intent.Faq: {
        const faq = tenant.faqs.find((f) => f.id === classified.matchedFaqId);
        const reply =
          faq?.answer ??
          'Let me connect you with a team member who can help with that.';
        if (!faq) {
          return this.raiseHandoff(
            tenant,
            customer,
            conversation,
            state,
            body,
            'unhandled',
            reply,
          );
        }
        return { reply, intent: Intent.Faq };
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
        return {
          reply: `Hello! How can we help you today? You can ask about our hours, location, services, or request an appointment.`,
          intent: Intent.Greeting,
        };

      // Unknown / low-confidence -> route to a human, never guess.
      default:
        return this.raiseHandoff(
          tenant,
          customer,
          conversation,
          state,
          body,
          'low_confidence',
          'Thanks for your message. A team member will follow up with you shortly.',
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
        reply: this.stateMachine.completionMessage(state.slots),
        intent: Intent.AppointmentRequest,
        createdAppointmentId: appointment.id,
      };
    }

    state.step = step;
    await this.stateStore.save(tenant.slug, customer.phone, state);
    return {
      reply: this.stateMachine.promptFor(step, tenant, state.slots),
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
    if (service.flow === 'external_link') {
      await this.stateStore.clear(tenant.slug, customer.phone);
      const link = service.bookingUrl
        ? `You can book ${service.name} directly here: ${service.bookingUrl}`
        : `Please contact our team to book ${service.name}.`;
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
        'A team member will assist you with this request shortly.',
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
      tenant.emergencyMessage ??
      'This looks urgent. Our team has been notified and will contact you ' +
        'directly as soon as possible.';
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
