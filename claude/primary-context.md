You are helping me build a product called WhaReception.

WhaReception is not a generic chatbot. It is a modular, multi-tenant WhatsApp receptionist platform for small and medium service-based businesses.

The first niche is veterinary clinics. The MVP should help clinics answer FAQs, collect appointment requests, detect emergencies, create human handoff requests, and send structured summaries to the clinic team.

The product should not replace staff or the existing appointment system. It should organize WhatsApp conversations before a human confirms or responds.

Use this stack:

* TypeScript
* NestJS
* PostgreSQL
* Prisma
* Zod
* Docker
* BullMQ + Redis if background jobs are needed
* Meta WhatsApp Cloud API later
* Mock WhatsApp provider for local development
* Mock LLM provider first

Do not build a frontend dashboard yet.

The MVP should include:

* Multi-tenant configuration
* Demo veterinary clinic seed data
* Local simulation endpoint for testing messages
* FAQ handling
* Appointment request flow
* Emergency detection
* Human handoff
* Conversation state management
* Message storage
* AppointmentRequest storage
* HandoffRequest storage
* WebhookEvent storage
* Clean modular NestJS architecture

Important rules:

* Do not use AI for every message.
* Use deterministic rules and configured business data first.
* Use a state machine for appointment collection.
* Use AI only for ambiguous intent classification or structured data extraction.
* Validate AI outputs with Zod.
* Never invent prices, availability, medical advice, promotions, appointment confirmations, emergency instructions, or services not configured by the business.

Start by creating a clean NestJS project structure and propose the first implementation plan before writing code.