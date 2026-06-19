# Conectar WhaReception a WhatsApp (Meta Cloud API)

Esta guía conecta un tenant (negocio) a un número real de WhatsApp usando la
**WhatsApp Cloud API** de Meta. El código de Fase 2 ya implementa el webhook,
la verificación de firma, la cola de procesamiento y el envío de respuestas;
aquí solo configuras las credenciales.

> Mientras no tengas cuenta de Meta, puedes probar todo localmente con el
> endpoint de simulación (`POST /sim/messages`) o enviando un payload de Meta
> de prueba al webhook. Ver "Probar sin Meta" al final.

---

## 1. Requisitos previos

- Cuenta de **Meta Business** (business.facebook.com).
- Una app en **developers.facebook.com** con el producto **WhatsApp** agregado.
- Un **número de teléfono** que NO esté usando la app de WhatsApp normal
  (Meta lo registra en la plataforma; durante pruebas Meta te da un número de
  test gratuito).
- Tu servidor accesible por **HTTPS público**. Para desarrollo: `ngrok http 3000`.

---

## 2. Datos que necesitas de Meta

En el panel de la app (WhatsApp > API Setup / Configuration) obtienes:

| Dato | Dónde | Variable de entorno |
|------|-------|---------------------|
| Phone number ID | WhatsApp > API Setup | `WHATSAPP_PHONE_NUMBER_ID` |
| Access token (permanente) | System User token (ver paso 5) | `WHATSAPP_ACCESS_TOKEN` |
| App Secret | App > Settings > Basic | `WHATSAPP_APP_SECRET` |
| Verify token | **lo inventas tú** | `WHATSAPP_VERIFY_TOKEN` |

---

## 3. Configurar el `.env`

```env
WHATSAPP_PROVIDER=meta
WHATSAPP_PHONE_NUMBER_ID=<phone_number_id>
WHATSAPP_ACCESS_TOKEN=<token_permanente>
WHATSAPP_APP_SECRET=<app_secret>
WHATSAPP_VERIFY_TOKEN=<algo_secreto_que_inventas>
```

Con `WHATSAPP_PROVIDER=meta`, las respuestas salen por la Cloud API real.
Con `WHATSAPP_APP_SECRET` definido, el webhook **rechaza** cualquier POST sin
firma válida (seguridad).

---

## 4. Mapear el número al tenant

Cada negocio recibe mensajes en su propio `phone_number_id`. Hay que guardarlo
en el tenant para que el webhook sepa a quién enrutar:

```sql
UPDATE "Tenant"
SET "whatsappPhoneNumberId" = '<phone_number_id>'
WHERE slug = 'demo-vet';
```

(En el seed, `demo-vet` trae un id de ejemplo `123456789012345` que debes
reemplazar por el real.)

---

## 5. Token de acceso permanente

El token que Meta muestra por defecto **expira en 24h**. Para producción:

1. Business Settings > Users > **System Users** > crear uno.
2. Asignarle la app y el activo de WhatsApp con permisos
   `whatsapp_business_messaging` y `whatsapp_business_management`.
3. **Generate token** (sin expiración) → ese es tu `WHATSAPP_ACCESS_TOKEN`.

---

## 6. Registrar el webhook

1. Expón el servidor: `ngrok http 3000` → te da `https://XXXX.ngrok-free.app`.
2. En la app de Meta: **WhatsApp > Configuration > Webhook > Edit**.
   - **Callback URL**: `https://XXXX.ngrok-free.app/webhooks/whatsapp`
   - **Verify token**: el mismo de `WHATSAPP_VERIFY_TOKEN`.
3. Meta llama al `GET /webhooks/whatsapp` para el handshake. Si el token
   coincide, devuelve el `challenge` y queda verificado. ✅ (ya implementado)
4. En **Webhook fields**, suscríbete a **`messages`**.

---

## 7. Probar de punta a punta

1. Manda un WhatsApp desde tu teléfono al número del negocio.
2. Meta hace `POST /webhooks/whatsapp` → se verifica la firma → se encola →
   el worker resuelve el tenant, corre el motor y responde por la Cloud API.
3. Recibes la respuesta del bot en tu teléfono.

Logs útiles (en el servidor):

```
[WhatsAppController] Enqueued 1 inbound message(s).
[MockWhatsAppClient]/[MetaWhatsAppClient] [OUTBOUND -> ...]
```

---

## 8. Límites importantes de WhatsApp (para vender bien)

- **Ventana de 24h**: solo puedes responder texto libre dentro de las 24h
  posteriores al último mensaje del cliente. Fuera de esa ventana se requieren
  **plantillas (templates) aprobadas** por Meta. (No implementado aún — es el
  siguiente paso si quieres mensajes proactivos/recordatorios.)
- **Un humano atiende**: cuando se crea un handoff, el bot **se calla** en esa
  conversación. Para devolvérsela al bot:
  `POST /admin/handoffs/:id/resolve` con header `x-admin-token`.

---

## Probar sin cuenta de Meta (local)

Puedes simular exactamente el payload que manda Meta:

```bash
curl -X POST localhost:3000/webhooks/whatsapp \
  -H 'Content-Type: application/json' \
  -d '{
    "object":"whatsapp_business_account",
    "entry":[{"changes":[{"field":"messages","value":{
      "metadata":{"phone_number_id":"123456789012345"},
      "messages":[{"from":"50677778888","id":"wamid.LOCAL1","type":"text",
                   "text":{"body":"what time do you open?"}}]
    }}]}]
  }'
```

Con `WHATSAPP_APP_SECRET` vacío, la verificación de firma se omite para que
esta prueba local funcione. El flujo interno (cola → motor → envío) es idéntico
al real; solo cambia que el envío sale por el cliente mock.
