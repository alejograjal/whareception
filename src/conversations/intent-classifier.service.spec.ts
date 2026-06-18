import { IntentClassifierService } from './intent-classifier.service';
import { MockLlmProvider } from '../llm/mock-llm.provider';
import { Intent, IntentSource } from '../common/types';
import { TenantConfig } from '../tenants/tenants.service';

const tenant = {
  emergencyKeywords: ['bleeding', 'emergency', 'poisoned'],
  faqs: [
    { id: 'f-hours', keywords: ['hours', 'open'], answer: 'We open at 8.' },
    { id: 'f-loc', keywords: ['location', 'where'], answer: 'In Alajuela.' },
  ],
  services: [
    { id: 's1', name: 'Vaccination', keywords: ['vaccine', 'vacuna'], flow: 'lead_only' },
    { id: 's2', name: 'Grooming', keywords: ['grooming'], flow: 'external_link' },
  ],
} as unknown as TenantConfig;

function build(minConfidence = 0.6): IntentClassifierService {
  const config = { get: () => minConfidence };
  return new IntentClassifierService(
    new MockLlmProvider(),
    config as never,
  );
}

describe('IntentClassifierService', () => {
  const svc = build();

  it('flags emergency keywords with a deterministic rule', () => {
    expect(svc.detectEmergency(tenant, 'my dog is bleeding')).toBe(true);
    expect(svc.detectEmergency(tenant, 'what time do you open')).toBe(false);
  });

  it('classifies emergencies before anything else', async () => {
    const r = await svc.classify(tenant, 'help he is bleeding', []);
    expect(r.intent).toBe(Intent.Emergency);
    expect(r.source).toBe(IntentSource.Rule);
  });

  it('matches an FAQ by keyword', async () => {
    const r = await svc.classify(tenant, 'what are your hours?', []);
    expect(r.intent).toBe(Intent.Faq);
    expect(r.matchedFaqId).toBe('f-hours');
  });

  it('detects explicit human requests', async () => {
    const r = await svc.classify(tenant, 'can I talk to a human please', []);
    expect(r.intent).toBe(Intent.HumanRequested);
  });

  it('routes appointment keywords to AppointmentRequest', async () => {
    const r = await svc.classify(tenant, 'I want to book an appointment', []);
    expect(r.intent).toBe(Intent.AppointmentRequest);
  });

  it('treats a bare service mention as an appointment lead', async () => {
    const r = await svc.classify(tenant, 'do you do vaccines', []);
    expect(r.intent).toBe(Intent.AppointmentRequest);
    expect(r.matchedServiceId).toBe('s1');
  });
});
