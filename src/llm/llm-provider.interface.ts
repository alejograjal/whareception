import { IntentClassification, SlotExtraction } from './llm.schemas';

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export interface ClassifyIntentInput {
  message: string;
  // Names of services configured for the tenant, to ground the classification.
  serviceNames: string[];
  // Recent conversation turns for context (oldest first).
  history?: { role: string; body: string }[];
}

export interface ExtractSlotsInput {
  message: string;
  // Slots already known, so the model focuses on what is still missing.
  knownSlots: Partial<SlotExtraction>;
  serviceNames: string[];
}

/**
 * Adapter boundary for all LLM usage. The rest of the codebase depends only
 * on this interface; concrete providers (OpenAI, mock) are swapped via DI.
 *
 * Implementations MUST return values already validated against the Zod
 * schemas in llm.schemas.ts.
 */
export interface LlmProvider {
  classifyIntent(input: ClassifyIntentInput): Promise<IntentClassification>;
  extractSlots(input: ExtractSlotsInput): Promise<SlotExtraction>;
}
