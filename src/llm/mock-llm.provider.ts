import { Injectable, Logger } from '@nestjs/common';
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
 * Deterministic, offline LLM stand-in. Uses simple keyword heuristics so the
 * full pipeline can be tested without network access or an API key. Output is
 * validated through the same Zod schemas as the real provider.
 */
@Injectable()
export class MockLlmProvider implements LlmProvider {
  private readonly logger = new Logger(MockLlmProvider.name);

  async classifyIntent(
    input: ClassifyIntentInput,
  ): Promise<IntentClassification> {
    const text = input.message.toLowerCase();
    let intent = Intent.Unknown;
    let confidence = 0.3;
    let serviceHint: string | undefined;

    if (/\b(hi|hello|hey|hola|buenas|buenos dias)\b/.test(text)) {
      intent = Intent.Greeting;
      confidence = 0.9;
    } else if (
      /\b(appointment|book|schedule|cita|agendar|reservar|turno)\b/.test(text)
    ) {
      intent = Intent.AppointmentRequest;
      confidence = 0.85;
    } else if (/\b(human|person|agent|persona|humano|alguien)\b/.test(text)) {
      intent = Intent.HumanRequested;
      confidence = 0.8;
    } else if (/\?|hours|location|price|costo|precio|donde|cuanto/.test(text)) {
      intent = Intent.Faq;
      confidence = 0.65;
    }

    const matchedService = input.serviceNames.find((s) =>
      text.includes(s.toLowerCase()),
    );
    if (matchedService) {
      serviceHint = matchedService;
      if (intent === Intent.Unknown) {
        intent = Intent.AppointmentRequest;
        confidence = 0.7;
      }
    }

    this.logger.debug(`mock classifyIntent => ${intent} (${confidence})`);
    return intentClassificationSchema.parse({
      intent,
      confidence,
      serviceHint: serviceHint ?? null,
    });
  }

  async extractSlots(input: ExtractSlotsInput): Promise<SlotExtraction> {
    const text = input.message;
    const lower = text.toLowerCase();
    const result: SlotExtraction = {};

    // "my name is X", "soy X", "me llamo X"
    const nameMatch =
      text.match(/(?:my name is|i am|i'm|soy|me llamo)\s+([A-Za-zÀ-ÿ]+)/i);
    if (nameMatch && !input.knownSlots.customerName) {
      result.customerName = this.capitalize(nameMatch[1]);
    }

    // "my dog/cat X is named Y", "mi perro X", "se llama Y"
    const petMatch = text.match(
      /(?:dog|cat|pet|perro|gato|mascota)\s+(?:is\s+|named\s+|se llama\s+)?([A-Za-zÀ-ÿ]+)/i,
    );
    if (petMatch && !input.knownSlots.petName) {
      result.petName = this.capitalize(petMatch[1]);
    }

    if (/\bdog\b|\bperro\b/.test(lower)) result.petType = 'Dog';
    else if (/\bcat\b|\bgato\b/.test(lower)) result.petType = 'Cat';

    const matchedService = input.serviceNames.find((s) =>
      lower.includes(s.toLowerCase()),
    );
    if (matchedService && !input.knownSlots.serviceName) {
      result.serviceName = matchedService;
    }

    if (/morning|afternoon|evening|mañana|tarde|noche|monday|tuesday|wednesday|thursday|friday|saturday|sunday|lunes|martes|miercoles|jueves|viernes|sabado|domingo/i.test(text)) {
      if (!input.knownSlots.preferredTime) result.preferredTime = text.trim();
    }

    return slotExtractionSchema.parse(result);
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
