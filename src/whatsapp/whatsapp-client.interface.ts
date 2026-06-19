export const WHATSAPP_CLIENT = Symbol('WHATSAPP_CLIENT');

export interface OutboundMessage {
  to: string;
  body: string;
  // Sender's Meta phone number id (the tenant's number). When omitted, the
  // client falls back to the globally configured WHATSAPP_PHONE_NUMBER_ID.
  fromPhoneNumberId?: string;
}

/**
 * Adapter boundary for sending WhatsApp messages. The mock implementation
 * logs sends for local development; the Meta implementation calls the Cloud
 * API (Phase 2).
 */
export interface WhatsAppClient {
  sendText(message: OutboundMessage): Promise<{ providerMessageId: string }>;
}
