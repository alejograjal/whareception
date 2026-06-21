import { z } from 'zod';

const serviceSchema = z.object({
  name: z.string().min(1),
  keywords: z.array(z.string()).default([]),
  flow: z
    .enum(['lead_only', 'external_link', 'human_handoff'])
    .default('lead_only'),
  bookingUrl: z.string().url().optional(),
});

const faqSchema = z.object({
  key: z.string().optional(),
  question: z.string().min(1),
  answer: z.string().min(1),
  keywords: z.array(z.string()).default([]),
});

/**
 * Payload to onboard a new business (tenant) with its services and FAQs in a
 * single call — no manual SQL needed.
 */
export const createTenantSchema = z.object({
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, numbers or dashes'),
  name: z.string().min(1),
  industry: z.string().default('veterinary'),
  timezone: z.string().default('America/Costa_Rica'),
  defaultLanguage: z.enum(['es', 'en']).default('es'),
  tone: z.string().default('amable y profesional'),
  // e.g. { "monday": "8:00 AM - 6:00 PM", "sunday": "Cerrado" }
  businessHours: z.record(z.string()).default({}),
  locationText: z.string().optional(),
  googleMapsUrl: z.string().url().optional(),
  internalWhatsappNumber: z.string().optional(),
  whatsappPhoneNumberId: z.string().optional(),
  emergencyKeywords: z.array(z.string()).default([]),
  emergencyMessage: z.string().optional(),
  services: z.array(serviceSchema).default([]),
  faqs: z.array(faqSchema).default([]),
});

export type CreateTenantDto = z.infer<typeof createTenantSchema>;
