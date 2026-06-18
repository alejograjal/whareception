import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Faq, Service } from '@prisma/client';
import { Env } from '../config/env.schema';
import {
  ClassifiedIntent,
  Intent,
  IntentSource,
} from '../common/types';
import {
  LLM_PROVIDER,
  LlmProvider,
} from '../llm/llm-provider.interface';
import { TenantConfig } from '../tenants/tenants.service';

/**
 * Decides what a customer message means. Deterministic rules run first
 * (emergency keywords, FAQ keywords, service/appointment keywords, explicit
 * human requests). The LLM is consulted ONLY when rules are inconclusive, and
 * its result is gated by a configurable minimum confidence — below which the
 * message is routed to a human.
 */
@Injectable()
export class IntentClassifierService {
  private readonly minConfidence: number;

  constructor(
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    config: ConfigService<Env, true>,
  ) {
    this.minConfidence = config.get('LLM_MIN_CONFIDENCE', { infer: true });
  }

  /** Returns true if the message hits any configured emergency keyword. */
  detectEmergency(tenant: TenantConfig, message: string): boolean {
    const text = message.toLowerCase();
    return tenant.emergencyKeywords.some((kw) =>
      text.includes(kw.toLowerCase()),
    );
  }

  /** Deterministic FAQ match by keyword overlap. */
  matchFaq(tenant: TenantConfig, message: string): Faq | null {
    const text = message.toLowerCase();
    return (
      tenant.faqs.find((faq) =>
        faq.keywords.some((kw) => text.includes(kw.toLowerCase())),
      ) ?? null
    );
  }

  /** Deterministic service match by keyword or name. */
  matchService(tenant: TenantConfig, message: string): Service | null {
    const text = message.toLowerCase();
    return (
      tenant.services.find(
        (svc) =>
          text.includes(svc.name.toLowerCase()) ||
          svc.keywords.some((kw) => text.includes(kw.toLowerCase())),
      ) ?? null
    );
  }

  /**
   * Full classification used when no flow is already active. Order:
   *   1. Emergency keywords
   *   2. Explicit human request
   *   3. FAQ keyword match
   *   4. Appointment / service keyword match
   *   5. LLM fallback (gated by min confidence)
   */
  async classify(
    tenant: TenantConfig,
    message: string,
    history: { role: string; body: string }[],
  ): Promise<ClassifiedIntent> {
    if (this.detectEmergency(tenant, message)) {
      return {
        intent: Intent.Emergency,
        source: IntentSource.Rule,
        confidence: 1,
      };
    }

    if (this.isExplicitHumanRequest(message)) {
      return {
        intent: Intent.HumanRequested,
        source: IntentSource.Rule,
        confidence: 1,
      };
    }

    const faq = this.matchFaq(tenant, message);
    if (faq) {
      return {
        intent: Intent.Faq,
        source: IntentSource.Rule,
        confidence: 1,
        matchedFaqId: faq.id,
      };
    }

    if (this.hasAppointmentKeyword(message)) {
      const service = this.matchService(tenant, message);
      return {
        intent: Intent.AppointmentRequest,
        source: IntentSource.Rule,
        confidence: 1,
        matchedServiceId: service?.id,
      };
    }

    // A bare service mention (e.g. "vaccines") is treated as an appointment lead.
    const service = this.matchService(tenant, message);
    if (service) {
      return {
        intent: Intent.AppointmentRequest,
        source: IntentSource.Rule,
        confidence: 0.9,
        matchedServiceId: service.id,
      };
    }

    // Ambiguous — fall back to the LLM.
    const ai = await this.llm.classifyIntent({
      message,
      serviceNames: tenant.services.map((s) => s.name),
      history,
    });

    if (ai.confidence < this.minConfidence) {
      return {
        intent: Intent.Unknown,
        source: IntentSource.Ai,
        confidence: ai.confidence,
      };
    }

    const hintedService = ai.serviceHint
      ? this.matchService(tenant, ai.serviceHint)
      : null;
    return {
      intent: ai.intent,
      source: IntentSource.Ai,
      confidence: ai.confidence,
      matchedServiceId: hintedService?.id,
    };
  }

  private isExplicitHumanRequest(message: string): boolean {
    return /\b(human|real person|agent|representative|persona|humano|alguien|hablar con)\b/i.test(
      message,
    );
  }

  private hasAppointmentKeyword(message: string): boolean {
    return /\b(appointment|appoint|book|booking|schedule|reserve|cita|agendar|reservar|turno)\b/i.test(
      message,
    );
  }
}
