import { ConversationStateMachine } from './conversation-state.machine';
import { AppointmentSlots, AppointmentStep } from '../common/types';
import { TenantConfig } from '../tenants/tenants.service';

const tenant = {
  services: [
    { id: 's1', name: 'Vaccination', flow: 'lead_only', keywords: [] },
    { id: 's2', name: 'Grooming', flow: 'external_link', keywords: [] },
  ],
} as unknown as TenantConfig;

describe('ConversationStateMachine', () => {
  const sm = new ConversationStateMachine();

  it('asks for the first missing required slot in order', () => {
    expect(sm.nextStep({})).toBe(AppointmentStep.Service);
    expect(sm.nextStep({ serviceName: 'Vaccination' })).toBe(
      AppointmentStep.CustomerName,
    );
    expect(
      sm.nextStep({ serviceName: 'Vaccination', customerName: 'Ana' }),
    ).toBe(AppointmentStep.PetName);
  });

  it('reports Complete once all required slots are filled', () => {
    const full: AppointmentSlots = {
      serviceName: 'Vaccination',
      customerName: 'Ana',
      petName: 'Luna',
      petType: 'Dog',
      preferredTime: 'Saturday morning',
    };
    expect(sm.nextStep(full)).toBe(AppointmentStep.Complete);
  });

  it('treats blank strings as unfilled', () => {
    expect(sm.nextStep({ serviceName: '   ' })).toBe(AppointmentStep.Service);
  });

  it('builds a completion summary from collected slots', () => {
    const msg = sm.completionMessage({
      serviceName: 'Vaccination',
      customerName: 'Ana',
      petName: 'Luna',
      petType: 'Dog',
      preferredTime: 'Saturday morning',
    });
    expect(msg).toContain('Ana');
    expect(msg).toContain('Luna');
    expect(msg).toContain('Vaccination');
    expect(msg).toContain('Normal');
  });
});
