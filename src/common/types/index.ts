/**
 * Intents the conversation engine can act on. Deterministic rules produce
 * most of these; the LLM classifier is only consulted for ambiguous input.
 */
export enum Intent {
  Greeting = 'greeting',
  Faq = 'faq',
  AppointmentRequest = 'appointment_request',
  Emergency = 'emergency',
  HumanRequested = 'human_requested',
  Unknown = 'unknown',
}

/** Source that decided the intent — useful for auditing AI vs. rules. */
export enum IntentSource {
  Rule = 'rule',
  Ai = 'ai',
}

export interface ClassifiedIntent {
  intent: Intent;
  source: IntentSource;
  confidence: number;
  // For FAQ matches, the resolved FAQ key/id; for appointments, a service hint.
  matchedFaqId?: string;
  matchedServiceId?: string;
}

/** Slots collected during the lead_only appointment flow. */
export interface AppointmentSlots {
  isEmergency?: boolean;
  serviceName?: string;
  customerName?: string;
  petName?: string;
  petType?: string;
  preferredTime?: string;
  reason?: string;
}

/** Steps of the appointment-collection state machine. */
export enum AppointmentStep {
  Service = 'service',
  CustomerName = 'customerName',
  PetName = 'petName',
  PetType = 'petType',
  PreferredTime = 'preferredTime',
  Complete = 'complete',
}

/** Top-level live conversation state persisted in Redis. */
export interface ConversationState {
  conversationId: string;
  customerId: string;
  // Current active flow; only "appointment" exists in the MVP.
  flow: 'idle' | 'appointment';
  step: AppointmentStep | null;
  slots: AppointmentSlots;
  updatedAt: string;
}

/** Result returned by the engine for a single inbound message. */
export interface EngineResult {
  reply: string;
  intent: Intent;
  createdAppointmentId?: string;
  createdHandoffId?: string;
}
