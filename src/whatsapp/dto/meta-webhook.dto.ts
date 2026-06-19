import { z } from 'zod';

/**
 * Loose schema for the Meta WhatsApp Cloud API webhook payload. We only model
 * the parts we consume; everything else is ignored. Meta also sends status
 * events (delivered/read) on the same webhook — those simply produce no
 * extractable messages.
 *
 * Reference shape:
 *   entry[].changes[].value.metadata.phone_number_id
 *   entry[].changes[].value.messages[] { id, from, type, text.body }
 */
const textMessageSchema = z.object({
  id: z.string(),
  from: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
});

const changeValueSchema = z.object({
  metadata: z
    .object({
      phone_number_id: z.string(),
      display_phone_number: z.string().optional(),
    })
    .optional(),
  messages: z.array(textMessageSchema).optional(),
});

const entrySchema = z.object({
  id: z.string().optional(),
  changes: z
    .array(z.object({ value: changeValueSchema, field: z.string().optional() }))
    .optional(),
});

export const metaWebhookSchema = z.object({
  object: z.string().optional(),
  entry: z.array(entrySchema).optional(),
});

export type MetaWebhookPayload = z.infer<typeof metaWebhookSchema>;

/** A single inbound text message normalized from the Meta payload. */
export interface NormalizedInboundMessage {
  phoneNumberId: string;
  from: string;
  body: string;
  providerMessageId: string;
}

/**
 * Extracts the text messages we can handle from a Meta webhook payload.
 * Non-text messages (images, audio, etc.) and status events are skipped.
 */
export function extractInboundMessages(
  payload: MetaWebhookPayload,
): NormalizedInboundMessage[] {
  const out: NormalizedInboundMessage[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const phoneNumberId = change.value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;
      for (const msg of change.value.messages ?? []) {
        if (msg.type === 'text' && msg.text?.body) {
          out.push({
            phoneNumberId,
            from: msg.from,
            body: msg.text.body,
            providerMessageId: msg.id,
          });
        }
      }
    }
  }
  return out;
}
