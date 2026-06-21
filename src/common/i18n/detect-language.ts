import { Language } from './messages';

// Domain + function words that strongly signal each language in short
// WhatsApp messages.
const ES_WORDS = new Set([
  'hola', 'buenas', 'buenos', 'dias', 'gracias', 'necesito', 'quiero',
  'cita', 'agendar', 'reservar', 'turno', 'cuando', 'donde', 'cuanto',
  'horario', 'horarios', 'precio', 'precios', 'perro', 'perra', 'gato',
  'gata', 'mascota', 'vacuna', 'vacunas', 'urgente', 'emergencia', 'mi',
  'el', 'la', 'los', 'las', 'para', 'favor', 'que', 'esta', 'abren',
  'cierran', 'ubicacion', 'direccion', 'consulta', 'tienen', 'puedo',
]);

const EN_WORDS = new Set([
  'hello', 'hi', 'hey', 'thanks', 'thank', 'need', 'want', 'appointment',
  'book', 'booking', 'schedule', 'when', 'where', 'how', 'much', 'hours',
  'price', 'prices', 'dog', 'cat', 'pet', 'vaccine', 'vaccines', 'urgent',
  'emergency', 'my', 'the', 'for', 'please', 'what', 'open', 'close',
  'location', 'address', 'do', 'you', 'can', 'i',
]);

/**
 * Lightweight language detection for short messages. Spanish-specific
 * characters are a strong signal; otherwise we compare keyword hits. When the
 * signal is weak or tied, the caller's fallback (the tenant default) is used.
 */
export function detectLanguage(text: string, fallback: Language): Language {
  if (/[áéíóúñ¿¡]/i.test(text)) return 'es';

  const tokens = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  let esHits = 0;
  let enHits = 0;
  for (const token of tokens) {
    if (ES_WORDS.has(token)) esHits++;
    if (EN_WORDS.has(token)) enHits++;
  }

  if (esHits > enHits) return 'es';
  if (enHits > esHits) return 'en';
  return fallback;
}
