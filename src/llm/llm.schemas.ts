import { z } from 'zod';
import { Intent } from '../common/types';

/**
 * Schema for the LLM intent-classification output. Every AI response is
 * validated against this before the engine acts on it.
 */
export const intentClassificationSchema = z.object({
  intent: z.nativeEnum(Intent),
  confidence: z.number().min(0).max(1),
  // Optional free-text hint about the service the customer referenced.
  serviceHint: z.string().nullish(),
});
export type IntentClassification = z.infer<typeof intentClassificationSchema>;

/**
 * Schema for structured appointment-slot extraction. All fields optional —
 * the LLM fills only what the customer actually provided. The engine never
 * fabricates values; missing slots are asked for deterministically.
 */
export const slotExtractionSchema = z.object({
  customerName: z.string().nullish(),
  petName: z.string().nullish(),
  petType: z.string().nullish(),
  serviceName: z.string().nullish(),
  preferredTime: z.string().nullish(),
  reason: z.string().nullish(),
});
export type SlotExtraction = z.infer<typeof slotExtractionSchema>;
