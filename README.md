# WhaReception

A modular, multi-tenant WhatsApp receptionist platform for small and medium businesses.

WhaReception helps businesses automate WhatsApp interactions by answering frequently asked questions, triaging customer inquiries, collecting appointment requests, and routing important cases to human staff.

The initial focus is on veterinary clinics, but the system is designed to be reusable across other service-based businesses such as aesthetic clinics, mechanic shops, nutritionists, barbershops, restaurants, and local service providers.

---

## Purpose

Many small and medium businesses rely heavily on WhatsApp to communicate with customers, but managing messages manually can become difficult during busy hours. Customers often ask the same questions about schedules, location, services, prices, appointments, and urgent cases.

WhaReception aims to reduce that operational load by acting as a lightweight WhatsApp receptionist.

The goal is not to fully replace human staff, but to organize incoming messages, collect useful information, and help businesses respond faster.

---

## Core Features

- WhatsApp webhook integration
- Multi-tenant business configuration
- FAQ automation
- Appointment request collection
- Customer inquiry triage
- Emergency or priority case detection
- Human handoff flow
- Conversation state management
- Service-based flows per business
- Configurable business hours, location, services, and tone
- Extensible architecture for future calendar and CRM integrations

---

## Initial Use Case: Veterinary Clinics

The first version is designed around veterinary clinics.

Example flows:

- Customer asks for business hours
- Customer asks for location
- Customer wants to book an appointment
- Customer asks about vaccines or grooming
- Customer reports a possible emergency
- Customer wants to speak with a human
- Customer sends an unclear message that needs classification

Instead of booking appointments automatically, the first version collects structured information and sends a summary to the business team for confirmation.

Example appointment request summary:

```text
New appointment request

Customer: Maria Gonzalez
Pet: Luna
Pet type: Dog
Service: Vaccination
Preferred time: Saturday morning
Urgency: Normal
Phone: +506 XXXX XXXX

Status: Pending confirmation
```

---

## Appointment Modes

WhaReception is designed to support different levels of scheduling complexity.

### `lead_only`

Collects customer information and sends a structured appointment request to the business.

This is the default MVP mode.

### `external_link`

Filters the customer inquiry and sends the customer to an existing external booking link.

Useful for businesses that already use an online booking system.

### `calendar_request`

Collects scheduling preferences and requires human confirmation before booking.

Planned for a future version.

### `calendar_auto`

Automatically books appointments using a calendar integration.

Planned for a future version.

---

## Recommended MVP Scope

The first version should stay simple and focused.

Included:

- Receive simulated or real WhatsApp messages
- Identify the business tenant
- Answer basic FAQs
- Collect appointment requests
- Detect emergency keywords
- Create handoff requests
- Store conversations and messages
- Notify the business with a structured summary

Not included in the first version:

- Automatic appointment booking
- Payment processing
- CRM integrations
- POS integrations
- Complex dashboard
- Full calendar synchronization
- Marketing campaigns

---

## Tech Stack

- **Language:** TypeScript
- **Backend:** NestJS
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Validation:** Zod
- **Messaging:** Meta WhatsApp Cloud API
- **Jobs / Queues:** BullMQ + Redis
- **Containerization:** Docker
- **Future Admin UI:** Next.js

---

## Architecture Goals

WhaReception is designed to be:

- Modular
- Multi-tenant
- Strongly typed
- Maintainable
- Extensible
- Provider-agnostic
- Easy to deploy
- Safe for customer-facing conversations

The system should avoid relying on AI for every interaction. Simple and predictable cases should be handled by deterministic rules, while AI should be used only when classification or structured extraction is needed.

---

## Proposed Project Structure

```text
src/
  app.module.ts

  config/
    env.schema.ts
    configuration.ts

  common/
    types/
    utils/
    errors/
    logging/

  tenants/
    tenants.module.ts
    tenants.service.ts

  whatsapp/
    whatsapp.module.ts
    whatsapp.controller.ts
    whatsapp.service.ts
    whatsapp-client.interface.ts
    meta-whatsapp.client.ts
    dto/

  conversations/
    conversations.module.ts
    conversations.service.ts
    conversation-state.machine.ts
    intent-classifier.service.ts

  appointments/
    appointments.module.ts
    appointments.service.ts

  handoff/
    handoff.module.ts
    handoff.service.ts

  llm/
    llm.module.ts
    llm-provider.interface.ts
    mock-llm.provider.ts
    openai.provider.ts

  notifications/
    notifications.module.ts
    notifications.service.ts

  prisma/
    prisma.module.ts
    prisma.service.ts
```

---

## Main Domain Concepts

### Tenant / Business

Represents a business using the platform.

Example fields:

- Business name
- Industry
- Timezone
- Business hours
- Location
- Internal WhatsApp number
- Appointment mode
- Tone of communication
- Emergency rules

### Service

Represents a service offered by a business.

Examples for a veterinary clinic:

- Medical consultation
- Vaccination
- Grooming
- Emergency care
- Surgery inquiry
- Pharmacy or product inquiry

### Conversation

Represents an active WhatsApp conversation with a customer.

### Message

Stores customer and assistant messages.

### Appointment Request

Stores structured information collected from a customer who wants an appointment.

### Handoff Request

Represents a case that should be handled by a human.

Examples:

- Emergency
- Customer explicitly asks for a person
- The assistant cannot confidently classify the request
- Sensitive or complex inquiry

---

## Example Tenant Configuration

```json
{
  "businessName": "Demo Vet",
  "industry": "veterinary",
  "timezone": "America/Costa_Rica",
  "appointmentMode": "lead_only",
  "businessHours": {
    "monday": "8:00 AM - 6:00 PM",
    "tuesday": "8:00 AM - 6:00 PM",
    "wednesday": "8:00 AM - 6:00 PM",
    "thursday": "8:00 AM - 6:00 PM",
    "friday": "8:00 AM - 6:00 PM",
    "saturday": "8:00 AM - 2:00 PM",
    "sunday": "Closed"
  },
  "locationText": "Alajuela, Costa Rica",
  "googleMapsUrl": "https://maps.google.com",
  "internalWhatsappNumber": "+506XXXXXXXX",
  "tone": "friendly and professional",
  "services": [
    {
      "name": "Medical consultation",
      "flow": "lead_only"
    },
    {
      "name": "Vaccination",
      "flow": "lead_only"
    },
    {
      "name": "Grooming",
      "flow": "external_link",
      "bookingUrl": "https://example.com/book"
    },
    {
      "name": "Emergency",
      "flow": "human_handoff"
    }
  ],
  "emergencyKeywords": [
    "emergency",
    "urgent",
    "bleeding",
    "not breathing",
    "poisoned",
    "seizure",
    "hit by car"
  ]
}
```

---

## Conversation Example

Customer:

```text
Hi, I need an appointment for my dog.
```

Assistant:

```text
Of course. Is this an emergency or a regular appointment?
```

Customer:

```text
Regular appointment. He needs vaccines.
```

Assistant:

```text
Perfect. What is your name and your pet's name?
```

Customer:

```text
My name is Alejandro and my dog is Rocky.
```

Assistant:

```text
Thanks, Alejandro. What day or time would you prefer?
```

Customer:

```text
Saturday morning.
```

Assistant:

```text
Got it. I will send your request to the clinic team so they can confirm availability.

Summary:
- Customer: Alejandro
- Pet: Rocky
- Service: Vaccination
- Preferred time: Saturday morning
- Urgency: Normal
```

Internal notification:

```text
New appointment request

Customer: Alejandro
Pet: Rocky
Service: Vaccination
Preferred time: Saturday morning
Urgency: Normal

Status: Pending confirmation
```

---

## Local Development

### Requirements

- Node.js
- Docker
- Docker Compose
- PostgreSQL
- Redis

### Install dependencies

```bash
npm install
```

### Start local services

```bash
docker compose up -d
```

### Run database migrations

```bash
npx prisma migrate dev
```

### Start the development server

```bash
npm run start:dev
```

---

## Environment Variables

Create a `.env` file based on `.env.example`.

```env
NODE_ENV=development
PORT=3000

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/whareception
REDIS_URL=redis://localhost:6379

WHATSAPP_VERIFY_TOKEN=local_verify_token
WHATSAPP_ACCESS_TOKEN=your_meta_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id

OPENAI_API_KEY=your_openai_api_key
```

---

## Development Without WhatsApp

The MVP should support a local simulation endpoint so the conversation engine can be tested without connecting to the real WhatsApp Cloud API.

Example simulated request:

```json
{
  "tenantId": "demo-vet",
  "from": "+50688888888",
  "message": "Hi, I want to book an appointment for my dog"
}
```

---

## AI Usage Principles

WhaReception should not blindly rely on AI for all responses.

The system should prioritize:

1. Deterministic rules for simple FAQs
2. Configured business data for factual answers
3. State machine flows for appointment requests
4. AI only for ambiguous intent classification or structured data extraction
5. Zod validation for all AI outputs
6. Human handoff when confidence is low

The assistant should never invent:

- Prices
- Medical advice
- Availability
- Promotions
- Appointment confirmations
- Emergency instructions beyond configured business rules

---

## Roadmap

### Phase 1: MVP

- Multi-tenant configuration
- WhatsApp webhook structure
- Local message simulation
- FAQ responses
- Appointment request collection
- Emergency detection
- Human handoff request
- Conversation storage

### Phase 2: WhatsApp Integration

- Meta WhatsApp Cloud API integration
- Real message receiving
- Real message sending
- Webhook verification
- Tenant resolution by phone number

### Phase 3: Business Notifications

- Send appointment summaries to internal WhatsApp
- Email notifications
- Daily summary reports

### Phase 4: Admin Configuration

- Basic admin UI
- Manage services
- Manage FAQs
- Manage business hours
- Manage external booking links

### Phase 5: Scheduling Integrations

- Google Calendar support
- External booking links
- Appointment confirmation flow
- Rescheduling requests
- Cancellation requests

### Phase 6: Advanced Features

- Analytics
- Conversation search
- Lead scoring
- CRM integrations
- Payment links
- Multi-language support

---

## Disclaimer

WhaReception is not intended to provide medical, veterinary, legal, or professional advice. For sensitive, urgent, or complex cases, the system should route the conversation to human staff.

For veterinary use cases, emergency-related messages should always trigger human handoff according to the business rules configured by the clinic.

---

## License

To be defined.
README_EOF

git add README.md
git commit -m "docs: add initial README"
