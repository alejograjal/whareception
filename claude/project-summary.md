WhaReception — Project Summary

1. Product Overview

WhaReception is a modular WhatsApp receptionist platform designed for small and medium service-based businesses.

The product helps businesses manage WhatsApp conversations more efficiently without replacing their staff. Its main purpose is to reduce repetitive WhatsApp work, organize incoming customer requests, and help teams respond faster.

The first validation niche will be veterinary clinics, but the platform should be flexible enough to support other industries later, such as:

* Aesthetic clinics
* Mechanic shops
* Nutritionists
* Barbershops
* Restaurants
* Local service businesses

The product should remain simple, affordable, reusable, and low-risk.

⸻

2. Core Product Idea

WhaReception works as a WhatsApp receptionist that helps businesses:

* Answer frequently asked questions.
* Filter incoming customer inquiries.
* Collect appointment or service request information.
* Detect urgent or emergency cases.
* Route important conversations to human staff.
* Send structured summaries to the business.
* Avoid losing customers when staff are busy.

The product should not initially replace the business’s existing appointment system. Instead, it acts as a layer in front of WhatsApp that organizes conversations and sends useful information to the business team.

⸻

3. Initial Niche: Veterinary Clinics

The first niche to validate is small and medium veterinary clinics.

This niche is attractive because veterinary clinics often receive repetitive WhatsApp messages about:

* Business hours
* Location
* Vaccines
* Grooming
* Medical consultations
* Emergencies
* Prices
* Appointment availability
* Pet shop or pharmacy products

The first version should help clinics filter, organize, and structure these conversations before a human responds.

⸻

4. Positioning

The product should not be sold as “AI” first.

The positioning should focus on operational help and simplicity.

General positioning

“A WhatsApp receptionist that helps your business respond faster and organize customer requests.”

Veterinary clinic positioning

“A WhatsApp receptionist for veterinary clinics that filters consultations, collects appointment requests, detects urgent cases, and sends your team organized summaries.”

The initial value is not full automation. The value is helping the business respond faster and avoid losing customers through WhatsApp.

⸻

5. Product Philosophy

The product must stay simple and affordable for small businesses.

The first version should avoid:

* Full automatic scheduling
* Complex dashboards
* Payment integrations
* CRM integrations
* POS integrations
* Calendar synchronization
* Replacing existing appointment systems

Instead, the MVP should focus on:

* FAQ automation
* Customer triage
* Appointment request collection
* Human handoff
* Structured summaries

⸻

6. Appointment Handling Strategy

The system should support different appointment handling modes through an appointment_mode.

6.1 lead_only

This is the default MVP mode.

The bot collects customer information and sends the business a structured appointment request. The business confirms manually.

Example information collected:

* Customer name
* Pet name
* Type of pet
* Service needed
* Reason for visit
* Preferred day/time
* Whether it is an emergency
* Phone number

Example internal summary:

New appointment request
Customer: Maria Gonzalez
Pet: Luna
Pet type: Dog
Service: Vaccination
Preferred time: Saturday morning
Urgency: Normal
Phone: +506 XXXX XXXX
Status: Pending confirmation

6.2 external_link

If the business already has an online booking system, the bot can filter the customer request and send the correct booking link.

Example:

* Grooming → send grooming booking link.
* Medical consultation → collect request and send to staff.
* Emergency → handoff to human.

This allows WhaReception to work with businesses that already use appointment tools.

6.3 calendar_request

Future mode.

The bot collects scheduling preferences and proposes availability, but still requires human confirmation.

This is not part of the first MVP.

6.4 calendar_auto

Future mode.

The bot books directly into a calendar such as Google Calendar.

This should not be part of the first version.

⸻

7. Why Not Automatic Scheduling at First

Automatic scheduling creates unnecessary complexity for the MVP.

Main risks:

* Double booking
* Cancellation handling
* Rescheduling
* Different service durations
* Existing appointment systems
* Staff availability
* Business-specific rules

For the MVP, the bot should not book appointments directly. It should collect structured appointment requests and send them to the business for manual confirmation.

This makes the product easier to sell, easier to implement, and less risky.

⸻

8. Recommended Technical Stack

The project should use a strongly typed and maintainable stack.

No Python.

Recommended stack:

* Language: TypeScript
* Backend: NestJS
* Database: PostgreSQL
* ORM: Prisma
* Validation: Zod
* Messaging: Meta WhatsApp Cloud API
* Queues / Jobs: BullMQ + Redis
* Containerization: Docker
* Future Admin UI: Next.js

NestJS is preferred because it encourages modular architecture, dependency injection, controllers, services, DTOs, and clear boundaries.

⸻

9. AI Coding Assistant Context

The project will be built using Claude inside Visual Studio.

Important instruction for the coding assistant:

Do not build a generic chatbot.

Build a modular, multi-tenant WhatsApp receptionist platform for small and medium businesses, starting with veterinary clinics.

The architecture should support future industries and configurations through tenants, services, FAQs, appointment modes, conversation flows, and human handoff rules.

⸻

10. Suggested Core Architecture

Suggested folder structure:

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

⸻

11. Main Domain Entities

Tenant / Business

Represents a business using the platform.

Possible fields:

* Name
* Industry
* Timezone
* Business hours
* Location
* Internal WhatsApp number
* Appointment mode
* Tone
* Emergency rules
* External booking link if applicable

Service

Represents a service offered by the business.

For a veterinary clinic, examples include:

* Medical consultation
* Vaccination
* Grooming
* Emergency care
* Surgery inquiry
* Pet shop or pharmacy inquiry

Each service can define its own flow:

* lead_only
* external_link
* human_handoff

FAQ

Stores frequently asked questions and answers.

Examples:

* Business hours
* Location
* Vaccine information
* Grooming availability
* General service information

Customer

Represents the person contacting the business through WhatsApp.

Conversation

Represents the active conversation between a customer and the bot.

Message

Stores incoming and outgoing messages.

AppointmentRequest

Stores structured appointment request information collected from the customer.

HandoffRequest

Stores cases where a human should take over.

Examples:

* Emergency
* Customer asks for a human
* Sensitive case
* Low confidence classification
* Message cannot be handled safely

WebhookEvent

Stores incoming webhook events from WhatsApp for debugging, audit, and replay.

⸻

12. Conversation Flow Examples

Business Hours

Customer:

What time do you open?

Bot:

We are open Monday to Saturday from 8:00 AM to 6:00 PM. Sunday is closed.

Location

Customer:

Where are you located?

Bot:

We are located in Alajuela, Costa Rica. Here is our location: [Google Maps link]

Appointment Request

Customer:

Hi, I need an appointment for my dog.

Bot:

Of course. Is this an emergency or a regular appointment?

Customer:

Regular appointment. He needs vaccines.

Bot:

Perfect. What is your name and your pet's name?

Customer:

My name is Alejandro and my dog is Rocky.

Bot:

Thanks, Alejandro. What day or time would you prefer?

Customer:

Saturday morning.

Bot:

Got it. I will send your request to the clinic team so they can confirm availability.

Internal notification:

New appointment request
Customer: Alejandro
Pet: Rocky
Service: Vaccination
Preferred time: Saturday morning
Urgency: Normal
Status: Pending confirmation

Emergency

If a customer mentions emergency keywords such as:

* blood
* not breathing
* seizure
* poisoned
* hit by car
* urgent
* emergency

The bot should not give medical advice.

It should immediately create a handoff request and tell the customer that the team should be contacted directly according to the business’s emergency instructions.

⸻

13. AI Usage Strategy

The system should not rely on AI for every message.

Priority order:

1. Deterministic rules for simple FAQs.
2. Configured business data for factual answers.
3. State machine flows for appointment requests.
4. AI only for ambiguous intent classification or structured data extraction.
5. Validate all AI outputs with Zod.
6. Use human handoff when confidence is low.

The bot must not invent:

* Prices
* Medical advice
* Availability
* Promotions
* Appointment confirmations
* Emergency instructions
* Services not configured by the business

⸻

14. LLM Provider Design

Create an interface such as LlmProvider so the system can switch providers later.

Initial providers:

* MockLlmProvider for local testing
* OpenAIProvider prepared for future use

The AI should be isolated behind an adapter. It should not be spread throughout the codebase.

⸻

15. WhatsApp Integration Strategy

The WhatsApp module should include:

* Webhook verification
* Message receiving
* Message normalization
* Message sending
* Meta WhatsApp Cloud API adapter
* Local simulation endpoint for development

The MVP should support testing without real WhatsApp integration.

Example simulated message request:

{
  "tenantId": "demo-vet",
  "from": "+50688888888",
  "message": "Hi, I want to book an appointment for my dog"
}

⸻

16. Multi-Tenant Configuration Example

Each tenant/business should have its own configuration.

Example:

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

This allows the same system to be reused across different industries.

⸻

17. MVP Scope

The first version should include:

* NestJS backend
* TypeScript strict mode
* Prisma + PostgreSQL
* Zod validation
* Local simulation endpoint
* Multi-tenant configuration
* Basic FAQ handling
* Appointment request flow
* Emergency detection
* Human handoff request
* Conversation state management
* Mock WhatsApp sending
* Mock LLM provider
* Seed data for a demo veterinary clinic

The first version should not include:

* Frontend dashboard
* Payments
* Automatic calendar booking
* CRM integrations
* POS integrations
* Marketing campaigns
* Complex authentication

⸻

18. Suggested Product Tiers

Pilot Plan

Designed for first validation.

Features:

* FAQ responses
* Appointment request collection
* Emergency detection
* Human handoff
* Internal summary notifications

Possible pricing:

* Setup: ₡30,000–₡50,000
* Monthly: ₡20,000–₡30,000

Basic Plan

For regular small businesses.

Features:

* Everything in Pilot
* More FAQs
* More services
* Monthly adjustments
* Basic reporting

Possible pricing:

* Setup: ₡50,000–₡75,000
* Monthly: ₡35,000–₡45,000

Pro Plan

For businesses needing deeper automation.

Features:

* External booking link routing
* Calendar request flow
* Reminders
* More advanced configuration

Possible pricing:

* Setup: ₡100,000+
* Monthly: ₡60,000–₡90,000+

⸻

19. First Validation Target

A good first prospect is a small or medium veterinary clinic that:

* Uses WhatsApp visibly
* Receives repetitive questions
* Does not appear to have a highly sophisticated automated system
* Needs help organizing messages
* Has appointment or service requests
* Has a decision-maker who can approve quickly

The first product should not try to replace their appointment system. It should help them filter WhatsApp and send structured requests to their team.

⸻

20. Initial Sales Message

Hi, I saw that your clinic handles customer inquiries through WhatsApp.
I am building a lightweight WhatsApp receptionist for veterinary clinics. It helps answer common questions, collect appointment requests, detect urgent cases, and send your team an organized summary so they can confirm manually.
It does not replace your staff or your appointment system. It simply helps organize incoming messages when your team is busy.
I am looking for 1–2 clinics to run a small pilot at a low cost. Would you be open to seeing a quick demo with an example based on your clinic?

⸻

21. Key Product Principle

The first version should be:

Simple, reusable, low-risk, and affordable.

WhaReception should help businesses organize WhatsApp conversations before trying to automate their entire operation.