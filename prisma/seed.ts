import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seeds a demo veterinary clinic tenant ("demo-vet") with services, FAQs,
 * business hours and emergency rules so the simulation endpoint can be
 * exercised end-to-end without any external configuration.
 */
async function main() {
  const slug = 'demo-vet';

  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: { whatsappPhoneNumberId: '123456789012345' },
    create: {
      slug,
      name: 'Demo Vet',
      industry: 'veterinary',
      timezone: 'America/Costa_Rica',
      appointmentMode: 'lead_only',
      tone: 'friendly and professional',
      locationText: 'Alajuela, Costa Rica',
      googleMapsUrl: 'https://maps.google.com',
      internalWhatsappNumber: '+50688880000',
      // Demo phone_number_id used by the simulated Meta webhook. Replace with
      // the real one Meta assigns to this clinic's number in production.
      whatsappPhoneNumberId: '123456789012345',
      businessHours: {
        monday: '8:00 AM - 6:00 PM',
        tuesday: '8:00 AM - 6:00 PM',
        wednesday: '8:00 AM - 6:00 PM',
        thursday: '8:00 AM - 6:00 PM',
        friday: '8:00 AM - 6:00 PM',
        saturday: '8:00 AM - 2:00 PM',
        sunday: 'Closed',
      },
      emergencyKeywords: [
        'emergency',
        'emergencia',
        'urgent',
        'urgente',
        'bleeding',
        'sangrando',
        'sangre',
        'not breathing',
        'no respira',
        'poisoned',
        'envenenado',
        'seizure',
        'convulsion',
        'hit by car',
        'atropellado',
      ],
      emergencyMessage:
        'This may be an emergency. Please call the clinic directly at ' +
        '+506 8888 0000 right now. Our team has been notified and will ' +
        'contact you as soon as possible.',
    },
  });

  // Remove existing services/faqs for an idempotent reseed.
  await prisma.service.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.faq.deleteMany({ where: { tenantId: tenant.id } });

  await prisma.service.createMany({
    data: [
      {
        tenantId: tenant.id,
        name: 'Medical consultation',
        keywords: ['consultation', 'consulta', 'sick', 'enfermo', 'checkup', 'revision'],
        flow: 'lead_only',
      },
      {
        tenantId: tenant.id,
        name: 'Vaccination',
        keywords: ['vaccine', 'vaccination', 'vacuna', 'vacunas', 'shot'],
        flow: 'lead_only',
      },
      {
        tenantId: tenant.id,
        name: 'Grooming',
        keywords: ['grooming', 'groom', 'bath', 'baño', 'estetica', 'corte'],
        flow: 'external_link',
        bookingUrl: 'https://example.com/book/grooming',
      },
      {
        tenantId: tenant.id,
        name: 'Emergency',
        keywords: ['emergency', 'emergencia', 'urgent', 'urgente'],
        flow: 'human_handoff',
      },
    ],
  });

  await prisma.faq.createMany({
    data: [
      {
        tenantId: tenant.id,
        key: 'hours',
        question: 'What are your business hours?',
        answer:
          'We are open Monday to Friday from 8:00 AM to 6:00 PM, ' +
          'Saturday from 8:00 AM to 2:00 PM, and closed on Sunday.',
        keywords: ['hours', 'horario', 'open', 'abren', 'close', 'cierran', 'schedule'],
      },
      {
        tenantId: tenant.id,
        key: 'location',
        question: 'Where are you located?',
        answer:
          'We are located in Alajuela, Costa Rica. Here is our location: ' +
          'https://maps.google.com',
        keywords: ['location', 'ubicacion', 'where', 'donde', 'address', 'direccion', 'map', 'mapa'],
      },
      {
        tenantId: tenant.id,
        key: 'parking',
        question: 'Do you have parking?',
        answer: 'Yes, we have free parking available for our clients.',
        keywords: ['parking', 'parqueo', 'estacionamiento'],
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
