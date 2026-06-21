import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Generic demo tenant. The platform is multi-industry; this demo happens to be
// a veterinary clinic (the launch niche), but the slug/name are generic so it
// is not tied to "vet".
const DEMO_SLUG = 'demo';

/**
 * Seeds a generic demo business ("demo") with services, FAQs, business hours
 * and emergency rules in Spanish, so the simulation endpoint can be exercised
 * end-to-end without any external configuration.
 */
async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: DEMO_SLUG },
    update: {
      whatsappPhoneNumberId: '123456789012345',
      defaultLanguage: 'es',
    },
    create: {
      slug: DEMO_SLUG,
      name: 'Negocio Demo',
      industry: 'veterinary',
      timezone: 'America/Costa_Rica',
      appointmentMode: 'lead_only',
      tone: 'amable y profesional',
      defaultLanguage: 'es',
      locationText: 'Alajuela, Costa Rica',
      googleMapsUrl: 'https://maps.google.com',
      internalWhatsappNumber: '+50688880000',
      // Demo phone_number_id used by the simulated Meta webhook. Replace with
      // the real one Meta assigns to this business's number in production.
      whatsappPhoneNumberId: '123456789012345',
      businessHours: {
        monday: '8:00 AM - 6:00 PM',
        tuesday: '8:00 AM - 6:00 PM',
        wednesday: '8:00 AM - 6:00 PM',
        thursday: '8:00 AM - 6:00 PM',
        friday: '8:00 AM - 6:00 PM',
        saturday: '8:00 AM - 2:00 PM',
        sunday: 'Cerrado',
      },
      emergencyKeywords: [
        'emergencia',
        'urgente',
        'emergency',
        'urgent',
        'sangrando',
        'sangre',
        'no respira',
        'envenenado',
        'envenenada',
        'convulsion',
        'convulsión',
        'atropellado',
        'atropellada',
      ],
      emergencyMessage:
        'Esto puede ser una emergencia. Por favor llame directamente a la ' +
        'clínica al +506 8888 0000 ahora mismo. Nuestro equipo ya fue ' +
        'notificado y le contactará lo antes posible.',
    },
  });

  // Idempotent reseed of services/faqs.
  await prisma.service.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.faq.deleteMany({ where: { tenantId: tenant.id } });

  await prisma.service.createMany({
    data: [
      {
        tenantId: tenant.id,
        name: 'Consulta médica',
        keywords: ['consulta', 'consultation', 'enfermo', 'enferma', 'revision', 'revisión', 'cita medica'],
        flow: 'lead_only',
      },
      {
        tenantId: tenant.id,
        name: 'Vacunación',
        keywords: ['vacuna', 'vacunas', 'vacunación', 'vaccine', 'vaccination'],
        flow: 'lead_only',
      },
      {
        tenantId: tenant.id,
        name: 'Estética / Grooming',
        keywords: ['estetica', 'estética', 'baño', 'bano', 'corte', 'grooming', 'groom'],
        flow: 'external_link',
        bookingUrl: 'https://example.com/reservar/estetica',
      },
      {
        tenantId: tenant.id,
        name: 'Emergencia',
        keywords: ['emergencia', 'urgente', 'emergency', 'urgent'],
        flow: 'human_handoff',
      },
    ],
  });

  await prisma.faq.createMany({
    data: [
      {
        tenantId: tenant.id,
        key: 'hours',
        question: '¿Cuál es el horario de atención?',
        answer:
          'Atendemos de lunes a viernes de 8:00 AM a 6:00 PM, los sábados de ' +
          '8:00 AM a 2:00 PM, y los domingos permanecemos cerrados.',
        keywords: ['horario', 'horarios', 'abren', 'cierran', 'hours', 'open', 'schedule'],
      },
      {
        tenantId: tenant.id,
        key: 'location',
        question: '¿Dónde están ubicados?',
        answer:
          'Estamos ubicados en Alajuela, Costa Rica. Aquí está nuestra ' +
          'ubicación: https://maps.google.com',
        keywords: ['ubicacion', 'ubicación', 'donde', 'dónde', 'direccion', 'dirección', 'location', 'where', 'mapa', 'map'],
      },
      {
        tenantId: tenant.id,
        key: 'parking',
        question: '¿Tienen parqueo?',
        answer: 'Sí, contamos con parqueo gratuito para nuestros clientes.',
        keywords: ['parqueo', 'estacionamiento', 'parking'],
      },
    ],
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded tenant "${tenant.slug}" (${tenant.id}).`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
