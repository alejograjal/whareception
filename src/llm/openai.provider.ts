import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Env } from '../config/env.schema';
import { Intent } from '../common/types';
import {
  ClassifyIntentInput,
  ExtractSlotsInput,
  LlmProvider,
} from './llm-provider.interface';
import {
  IntentClassification,
  intentClassificationSchema,
  SlotExtraction,
  slotExtractionSchema,
} from './llm.schemas';

/**
 * Real OpenAI-backed provider. Uses JSON-mode chat completions and validates
 * every response with Zod. On any failure (network, malformed output) it
 * returns a low-confidence / empty result so the engine can safely fall back
 * to a human handoff rather than acting on bad data.
 */
@Injectable()
export class OpenAiProvider implements LlmProvider {
  private readonly logger = new Logger(OpenAiProvider.name);
  private _client?: OpenAI;
  private readonly model: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.model = this.config.get('OPENAI_MODEL', { infer: true });
  }

  /**
   * Lazily constructs the OpenAI client on first use. This provider is always
   * registered in DI, but the client must not be created (and the API key not
   * required) unless LLM_PROVIDER=openai actually routes calls here.
   */
  private get client(): OpenAI {
    if (!this._client) {
      this._client = new OpenAI({
        apiKey: this.config.get('OPENAI_API_KEY', { infer: true }),
      });
    }
    return this._client;
  }

  async classifyIntent(
    input: ClassifyIntentInput,
  ): Promise<IntentClassification> {
    const system =
      'You are an intent classifier for a WhatsApp receptionist at a ' +
      'service business. Classify the customer message into exactly one ' +
      `intent from this list: ${Object.values(Intent).join(', ')}. ` +
      'Respond ONLY with a JSON object: ' +
      '{"intent": <intent>, "confidence": <0..1>, "serviceHint": <string|null>}. ' +
      'serviceHint should be one of the configured services if the customer ' +
      'clearly referenced one, otherwise null. Do not invent services. ' +
      `Configured services: ${input.serviceNames.join(', ') || 'none'}.`;

    const historyText = (input.history ?? [])
      .map((h) => `${h.role}: ${h.body}`)
      .join('\n');
    const user = historyText
      ? `Conversation so far:\n${historyText}\n\nLatest message: ${input.message}`
      : input.message;

    try {
      const raw = await this.complete(system, user);
      return intentClassificationSchema.parse(raw);
    } catch (err) {
      this.logger.error(
        `classifyIntent failed, defaulting to low-confidence unknown: ${
          (err as Error).message
        }`,
      );
      return { intent: Intent.Unknown, confidence: 0, serviceHint: null };
    }
  }

  async extractSlots(input: ExtractSlotsInput): Promise<SlotExtraction> {
    const system =
      'You extract appointment details from a customer message for a ' +
      'veterinary/service business. Respond ONLY with a JSON object with ' +
      'these optional keys: customerName, petName, petType, serviceName, ' +
      'preferredTime, reason. Use null for anything not explicitly stated. ' +
      'Never guess or fabricate values. serviceName must be one of: ' +
      `${input.serviceNames.join(', ') || 'none'}. ` +
      `Already known (do not re-extract): ${JSON.stringify(input.knownSlots)}.`;

    try {
      const raw = await this.complete(system, input.message);
      return slotExtractionSchema.parse(raw);
    } catch (err) {
      this.logger.error(
        `extractSlots failed, returning empty extraction: ${
          (err as Error).message
        }`,
      );
      return {};
    }
  }

  private async complete(
    system: string,
    user: string,
  ): Promise<unknown> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    const content = res.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty completion from OpenAI');
    }
    return JSON.parse(content);
  }
}
