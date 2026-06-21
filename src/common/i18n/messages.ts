import { AppointmentSlots } from '../types';

export type Language = 'es' | 'en';
export const SUPPORTED_LANGUAGES: Language[] = ['es', 'en'];
export const DEFAULT_LANGUAGE: Language = 'es';

/**
 * Customer-facing copy, per language. The code stays in English; only the text
 * the customer/team reads lives here. Spanish is the primary language.
 */
interface Catalog {
  greeting: string;
  askService: (options: string) => string;
  askCustomerName: string;
  askPetName: (customerName?: string) => string;
  askPetType: (petName?: string) => string;
  askPreferredTime: string;
  completion: (slots: AppointmentSlots) => string;
  faqFallback: string;
  externalLink: (service: string, url: string) => string;
  externalLinkNoUrl: (service: string) => string;
  handoffHuman: string;
  handoffLowConfidence: string;
  handoffSensitive: string;
  emergencyFallback: string;
  // Labels for the internal team summaries.
  summary: {
    appointmentTitle: string;
    handoffTitle: string;
    customer: string;
    pet: string;
    petType: string;
    service: string;
    preferredTime: string;
    urgency: string;
    phone: string;
    reason: string;
    message: string;
    normal: string;
    emergency: string;
    pendingConfirmation: string;
    followUp: string;
    unknown: string;
    notSpecified: string;
  };
}

const es: Catalog = {
  greeting:
    '¡Hola! ¿En qué le podemos ayudar? Puede consultar horarios, ubicación, ' +
    'servicios o solicitar una cita.',
  askService: (options) => `¿Qué servicio necesita${options}?`,
  askCustomerName: 'Con gusto. ¿Cuál es su nombre?',
  askPetName: (name) =>
    `Gracias${name ? `, ${name}` : ''}. ¿Cuál es el nombre de su mascota?`,
  askPetType: (petName) =>
    `¿Qué tipo de mascota es ${petName ?? 'su mascota'}? (por ejemplo: perro, gato)`,
  askPreferredTime: '¿Qué día u hora prefiere?',
  completion: (s) =>
    [
      'Listo. Enviaré su solicitud al equipo para que confirmen disponibilidad.',
      '',
      'Resumen:',
      `- Cliente: ${s.customerName ?? 'Sin especificar'}`,
      `- Mascota: ${s.petName ?? 'Sin especificar'} (${s.petType ?? 'Sin especificar'})`,
      `- Servicio: ${s.serviceName ?? 'Sin especificar'}`,
      `- Horario preferido: ${s.preferredTime ?? 'Sin especificar'}`,
      `- Urgencia: ${s.isEmergency ? 'Emergencia' : 'Normal'}`,
    ].join('\n'),
  faqFallback:
    'Permítame conectarle con un miembro del equipo que pueda ayudarle con eso.',
  externalLink: (service, url) =>
    `Puede reservar ${service} directamente aquí: ${url}`,
  externalLinkNoUrl: (service) =>
    `Por favor contacte a nuestro equipo para reservar ${service}.`,
  handoffHuman: 'Un miembro del equipo se pondrá en contacto con usted en breve.',
  handoffLowConfidence:
    'Gracias por su mensaje. Un miembro del equipo le dará seguimiento en breve.',
  handoffSensitive: 'Un miembro del equipo le atenderá con esta solicitud en breve.',
  emergencyFallback:
    'Esto parece urgente. Hemos notificado a nuestro equipo y le contactarán ' +
    'directamente lo antes posible.',
  summary: {
    appointmentTitle: 'Nueva solicitud de cita',
    handoffTitle: 'Se requiere atención humana',
    customer: 'Cliente',
    pet: 'Mascota',
    petType: 'Tipo de mascota',
    service: 'Servicio',
    preferredTime: 'Horario preferido',
    urgency: 'Urgencia',
    phone: 'Teléfono',
    reason: 'Motivo',
    message: 'Mensaje',
    normal: 'Normal',
    emergency: 'Emergencia',
    pendingConfirmation: 'Estado: Pendiente de confirmación',
    followUp: 'Por favor dar seguimiento a este cliente.',
    unknown: 'Sin especificar',
    notSpecified: 'Sin especificar',
  },
};

const en: Catalog = {
  greeting:
    'Hello! How can we help you today? You can ask about our hours, location, ' +
    'services, or request an appointment.',
  askService: (options) => `What service do you need${options}?`,
  askCustomerName: 'Great. What is your name?',
  askPetName: (name) =>
    `Thanks${name ? `, ${name}` : ''}. What is your pet's name?`,
  askPetType: (petName) =>
    `What type of pet is ${petName ?? 'your pet'}? (for example: dog, cat)`,
  askPreferredTime: 'What day or time would you prefer?',
  completion: (s) =>
    [
      'Got it. I will send your request to the team so they can confirm availability.',
      '',
      'Summary:',
      `- Customer: ${s.customerName ?? 'Not specified'}`,
      `- Pet: ${s.petName ?? 'Not specified'} (${s.petType ?? 'Not specified'})`,
      `- Service: ${s.serviceName ?? 'Not specified'}`,
      `- Preferred time: ${s.preferredTime ?? 'Not specified'}`,
      `- Urgency: ${s.isEmergency ? 'Emergency' : 'Normal'}`,
    ].join('\n'),
  faqFallback:
    'Let me connect you with a team member who can help with that.',
  externalLink: (service, url) =>
    `You can book ${service} directly here: ${url}`,
  externalLinkNoUrl: (service) =>
    `Please contact our team to book ${service}.`,
  handoffHuman: 'A team member will reach out to you shortly.',
  handoffLowConfidence:
    'Thanks for your message. A team member will follow up with you shortly.',
  handoffSensitive: 'A team member will assist you with this request shortly.',
  emergencyFallback:
    'This looks urgent. Our team has been notified and will contact you ' +
    'directly as soon as possible.',
  summary: {
    appointmentTitle: 'New appointment request',
    handoffTitle: 'Human handoff needed',
    customer: 'Customer',
    pet: 'Pet',
    petType: 'Pet type',
    service: 'Service',
    preferredTime: 'Preferred time',
    urgency: 'Urgency',
    phone: 'Phone',
    reason: 'Reason',
    message: 'Message',
    normal: 'Normal',
    emergency: 'Emergency',
    pendingConfirmation: 'Status: Pending confirmation',
    followUp: 'Please follow up with this customer.',
    unknown: 'Unknown',
    notSpecified: 'Not specified',
  },
};

const catalogs: Record<Language, Catalog> = { es, en };

export function t(lang: Language): Catalog {
  return catalogs[lang] ?? catalogs[DEFAULT_LANGUAGE];
}

export function asLanguage(value: string | null | undefined): Language {
  return value === 'en' || value === 'es' ? value : DEFAULT_LANGUAGE;
}
