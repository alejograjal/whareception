import { z } from 'zod';

/**
 * Payload for the local simulation endpoint. `tenantId` is the tenant slug
 * (e.g. "demo-vet"); `from` is the customer's WhatsApp number.
 */
export const simulateMessageSchema = z.object({
  tenantId: z.string().min(1),
  from: z.string().min(1),
  message: z.string().min(1),
});

export type SimulateMessageDto = z.infer<typeof simulateMessageSchema>;
