import { Injectable } from '@nestjs/common';
import {
  AppointmentSlots,
  AppointmentStep,
} from '../common/types';
import { TenantConfig } from '../tenants/tenants.service';

/**
 * Drives the lead_only appointment-collection flow. Pure logic: given the
 * slots collected so far, it decides which slot to ask for next and what
 * question to send. Slot extraction itself is done by the LLM adapter; this
 * machine only sequences the conversation and never fabricates data.
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

  /** Question to send the customer for a given step. */
  promptFor(
    step: AppointmentStep,
    tenant: TenantConfig,
    slots: AppointmentSlots,
  ): string {
    switch (step) {
      case AppointmentStep.Service: {
        const names = tenant.services
          .filter((s) => s.flow === 'lead_only')
          .map((s) => s.name);
        const options = names.length ? ` (${names.join(', ')})` : '';
        return `What service do you need${options}?`;
      }
      case AppointmentStep.CustomerName:
        return 'Great. What is your name?';
      case AppointmentStep.PetName:
        return `Thanks${slots.customerName ? `, ${slots.customerName}` : ''}. What is your pet's name?`;
      case AppointmentStep.PetType:
        return `What type of pet is ${slots.petName ?? 'your pet'}? (for example: dog, cat)`;
      case AppointmentStep.PreferredTime:
        return 'What day or time would you prefer?';
      case AppointmentStep.Complete:
        return this.completionMessage(slots);
    }
  }

  /** Customer-facing acknowledgement once all slots are collected. */
  completionMessage(slots: AppointmentSlots): string {
    return [
      'Got it. I will send your request to the team so they can confirm availability.',
      '',
      'Summary:',
      `- Customer: ${slots.customerName ?? 'Unknown'}`,
      `- Pet: ${slots.petName ?? 'Unknown'} (${slots.petType ?? 'Unknown'})`,
      `- Service: ${slots.serviceName ?? 'Unknown'}`,
      `- Preferred time: ${slots.preferredTime ?? 'Not specified'}`,
      `- Urgency: ${slots.isEmergency ? 'Emergency' : 'Normal'}`,
    ].join('\n');
  }

  private isFilled(value: unknown): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }
}
