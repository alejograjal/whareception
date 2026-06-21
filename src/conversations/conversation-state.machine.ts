import { Injectable } from '@nestjs/common';
import {
  AppointmentSlots,
  AppointmentStep,
} from '../common/types';
import { Language, t } from '../common/i18n/messages';
import { TenantConfig } from '../tenants/tenants.service';

/**
 * Drives the lead_only appointment-collection flow. Pure logic: given the
 * slots collected so far, it decides which slot to ask for next and what
 * question to send (in the conversation language). Slot extraction itself is
 * done elsewhere; this machine only sequences the conversation and never
 * fabricates data.
 */
@Injectable()
export class ConversationStateMachine {
  // Order in which required slots are collected.
  private readonly requiredOrder: {
    step: AppointmentStep;
    slot: keyof AppointmentSlots;
  }[] = [
    { step: AppointmentStep.Service, slot: 'serviceName' },
    { step: AppointmentStep.CustomerName, slot: 'customerName' },
    { step: AppointmentStep.PetName, slot: 'petName' },
    { step: AppointmentStep.PetType, slot: 'petType' },
    { step: AppointmentStep.PreferredTime, slot: 'preferredTime' },
  ];

  /** First still-missing step, or Complete when every required slot is filled. */
  nextStep(slots: AppointmentSlots): AppointmentStep {
    const missing = this.requiredOrder.find(
      ({ slot }) => !this.isFilled(slots[slot]),
    );
    return missing ? missing.step : AppointmentStep.Complete;
  }

  /** Question to send the customer for a given step, in the given language. */
  promptFor(
    step: AppointmentStep,
    tenant: TenantConfig,
    slots: AppointmentSlots,
    lang: Language,
  ): string {
    const m = t(lang);
    switch (step) {
      case AppointmentStep.Service: {
        const names = tenant.services
          .filter((s) => s.flow === 'lead_only')
          .map((s) => s.name);
        const options = names.length ? ` (${names.join(', ')})` : '';
        return m.askService(options);
      }
      case AppointmentStep.CustomerName:
        return m.askCustomerName;
      case AppointmentStep.PetName:
        return m.askPetName(slots.customerName);
      case AppointmentStep.PetType:
        return m.askPetType(slots.petName);
      case AppointmentStep.PreferredTime:
        return m.askPreferredTime;
      case AppointmentStep.Complete:
        return this.completionMessage(slots, lang);
    }
  }

  /** Customer-facing acknowledgement once all slots are collected. */
  completionMessage(slots: AppointmentSlots, lang: Language): string {
    return t(lang).completion(slots);
  }

  private isFilled(value: unknown): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }
}
