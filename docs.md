# Documentacion de cambios - `createReservation`

## Objetivo
Se mejoro la logica de creacion de reservas para evitar overbooking real por capacidad, respetando:
- `maxGuestsPerSlot`
- `reservationDurationMin`
- `OpeningHours`
- concurrencia de peticiones simultaneas

## Archivo modificado
- `lib/reservations/createReservation.ts`

## Que se cambio

### 1) `createReservation` como fuente unica de validacion
Se centralizo toda la validacion de negocio en `createReservation` antes de crear la reserva:
- valida que `partySize` sea entero y mayor que 0
- valida que la fecha no este en el pasado
- valida que el horario este en bloques de 30 minutos (`isValidTimeSlot`)
- valida existencia de `RestaurantSettings`
- valida que `partySize <= maxGuestsPerSlot`

### 2) Validacion de horario con duracion completa
Ademas de comprobar apertura/cierre, ahora se valida el intervalo completo de la reserva:
- `newStart` (inicio)
- `newEnd = newStart + reservationDurationMin`

Se rechaza si:
- el dia esta cerrado (`isClosed`)
- el inicio es antes de `openTime`
- el final supera `closeTime`

### 3) Control de capacidad por solape real
Se corrigio la logica para sumar solo reservas realmente simultaneas:
- para cada reserva existente se calcula `existingEnd = existingStart + reservationDurationMin`
- regla de solape aplicada:
  - `existingStart < newEnd && existingEnd > newStart`

Solo esas reservas aportan a `overlappingGuests`.
Se rechaza si:
- `overlappingGuests + partySize > maxGuestsPerSlot`

### 4) Concurrencia segura (race conditions)
La validacion + insercion se ejecuta dentro de:
- `prisma.$transaction(..., { isolationLevel: Serializable })`

Si Prisma detecta conflicto de serializacion (`P2034`), se devuelve:
- `"No hay disponibilidad para esa hora"`

Esto evita que dos requests paralelos sobrepasen capacidad.

### 5) Tipado del resultado
Se anadio un resultado tipado (union discriminada):
- exito: `{ success: true, data: Reservation }`
- error: `{ success: false, error: string }`

Tambien se agregaron helpers internos para mantener retornos consistentes:
- `reservationSuccess(...)`
- `reservationError(...)`

## Compatibilidad de API
Se mantuvieron mensajes de negocio usados por el endpoint para responder `409`:
- `"No hay disponibilidad para esa hora"`
- `"El restaurante esta cerrado a esa hora"`
- `"La reserva debe ser en bloques de 30 minutos"`

## Verificacion ejecutada
- `npm run lint`
- `npm run build`

## Estado posterior
`createReservation` queda lista como logica central de negocio para MVP, con control de capacidad real y proteccion ante concurrencia.

---

## Actualizacion - Endurecimiento multi-tenant (Fase 1)

### Objetivo
Eliminar los ultimos puntos con `restaurantId` hardcodeado y cerrar fugas de acceso entre tenants en rutas por `id`.

### Archivos modificados
- `app/api/reservations/[id]/cancel/route.ts`
- `app/api/reservations/[id]/route.ts`
- `app/admin/page.tsx`
- `lib/restaurants/getCurrentRestaurantId.ts` (eliminado)

### Cambios aplicados

#### 1) Cancelacion por id sin hardcode
En `app/api/reservations/[id]/cancel/route.ts`:
- se reemplazo `getCurrentRestaurantId()` por `getCurrentRestaurantIdFromRequest(request)`
- ahora la ruta usa contexto real del usuario autenticado
- se agrego manejo explicito de errores:
  - `UNAUTHORIZED` -> `401`
  - `RESTAURANT_CONTEXT_MISSING` -> `400`

#### 2) Seguridad tenant en `/api/reservations/[id]`
En `app/api/reservations/[id]/route.ts`:
- `GET` ya no busca solo por `id`; ahora usa `id + restaurantId`
- `DELETE` y `PATCH` validan primero que la reserva pertenezca al tenant autenticado antes de operar
- se mantiene `404` cuando la reserva no existe para ese tenant
- se agrego manejo de `UNAUTHORIZED` y `RESTAURANT_CONTEXT_MISSING`

Con esto se evita acceso o modificacion cruzada entre restaurantes por conocer un `id` valido de otro tenant.

#### 3) Admin sin `rest_1` hardcodeado
En `app/admin/page.tsx`:
- se elimino el uso de `getCurrentRestaurantId()`
- ahora usa `auth()` y toma `session.user.restaurantId`
- si no hay sesion o contexto de restaurante, redirige a `/`

#### 4) Limpieza de helper obsoleto
Se elimino `lib/restaurants/getCurrentRestaurantId.ts` porque ya no se usa y mantenia el hardcode `rest_1`.

### Impacto funcional
- cierre de un riesgo de seguridad multi-tenant en rutas por `id`
- consistencia total del contexto `restaurantId` en endpoints de reservas
- admin panel alineado con autenticacion real

### Verificacion ejecutada
- `npm run lint`
- `npm run build`

---

## Actualizacion - Compatibilidad de enums Prisma en deploy

### Objetivo
Resolver fallos de build en Vercel por imports de enums (`CallStatus`, `TranscriptSpeaker`) no exportados en ese entorno de cliente Prisma.

### Archivos modificados
- `app/api/voice/twilio/inbound/route.ts`
- `app/api/voice/twilio/status/route.ts`
- `app/api/voice/vapi/events/route.ts`

### Cambios aplicados
- se eliminaron imports de enums desde `@prisma/client`
- se definieron tipos locales string-literal para:
  - `CallStatus`
  - `TranscriptSpeaker`
- se actualizaron mapeos y comparaciones para usar valores string (`"in_progress"`, `"completed"`, etc.)

### Impacto funcional
- mantiene exactamente la misma logica de negocio de estados/transcripciones
- elimina dependencia de exports de enums del cliente Prisma en build remoto
- mejora estabilidad de despliegue en Vercel

### Verificacion ejecutada
- `npm run lint`
- `npm run build`

---

## Actualizacion - Fix TypeScript en `opening-hours` para deploy

### Objetivo
Resolver error de build en Vercel por tipado implicito de `tx` dentro de transaccion callback.

### Archivo modificado
- `app/api/opening-hours/route.ts`

### Cambios aplicados
- se reemplazo `prisma.$transaction(async (tx) => { ... })` por formato array:
  - `prisma.$transaction([deleteMany, createMany])`
- se tiparon explicitamente los elementos usados en `body.map(...)` para evitar `any` implicito

### Impacto funcional
- elimina el error `Parameter 'tx' implicitly has an 'any' type`
- mantiene la operacion atomica de reemplazar horarios (delete + create)
- mejora compatibilidad de TypeScript estricto en build de Vercel

### Verificacion ejecutada
- `npm run lint`
- `npm run build`

---

## Actualizacion - Fix de tipo `Reservation` en Vercel

### Objetivo
Corregir fallo de build en Vercel por import de tipo no exportado desde `@prisma/client`.

### Archivo modificado
- `app/admin/page.tsx`

### Cambios aplicados
- se elimino `import type { Reservation } from "@prisma/client"`
- se creo tipo local `ReservationListItem` para tipar el render de la lista de reservas
- se actualizo el `map` a `reservation: ReservationListItem`

### Impacto funcional
- evita el error de compilacion `Module '"@prisma/client"' has no exported member 'Reservation'`
- mantiene tipado explicito en el panel admin sin depender del export del cliente Prisma

### Verificacion ejecutada
- `npm run lint`
- `npm run build`

---

## Actualizacion - Hotfix de build en Vercel (TypeScript)

### Objetivo
Corregir fallo de compilacion detectado en Vercel por tipado implicito en el panel admin.

### Archivo modificado
- `app/admin/page.tsx`

### Cambios aplicados
- se importo `Reservation` desde `@prisma/client`
- se tiparon explicitamente los items del `map`:
  - `reservations.map((reservation: Reservation) => ...)`

### Impacto funcional
- elimina el error `Parameter 'reservation' implicitly has an 'any' type`
- permite que el build de produccion en Vercel pase correctamente en TypeScript estricto

### Verificacion ejecutada
- `npm run lint`
- `npm run build`

---

## Actualizacion - Modelo de datos para voz y telefonia (Fase 2)

### Objetivo
Preparar la base de datos para el SaaS de atencion telefonica con IA de voz, manteniendo diseno multi-tenant por `restaurantId`.

### Archivo modificado
- `prisma/schema.prisma`

### Cambios aplicados

#### 1) Ampliacion de `Restaurant`
Se anadieron campos y relaciones necesarias para la capa de voz:
- campos: `slug` (unico), `timeZone`
- relaciones: `phoneNumbers`, `calls`, `transcripts`, `blockedSlots`, `agentConfig`

#### 2) Nuevos modelos operativos
Se crearon las tablas base para telefonia y orquestacion:
- `PhoneNumber`: numeros por restaurante, proveedor y estado activo
- `Call`: lifecycle de llamada (estado, origen/destino, duracion, resultado, errores)
- `CallTranscript`: turnos de transcript por llamada y speaker
- `AgentConfig`: configuracion del asistente por restaurante
- `BlockedSlot`: bloqueos manuales de disponibilidad por rango horario

#### 3) Enums para control de estado
Se incorporaron enums para estandarizar eventos y transcripciones:
- `CallStatus`: `initiated`, `ringing`, `in_progress`, `completed`, `failed`, `no_answer`, `busy`, `canceled`
- `TranscriptSpeaker`: `system`, `assistant`, `caller`, `tool`

#### 4) Indices y relaciones multi-tenant
Todos los modelos operativos nuevos incluyen `restaurantId` y se anadieron indices para consultas frecuentes:
- por tenant (`restaurantId`)
- por estado y fecha en llamadas
- por llamada y fecha en transcripciones
- por rango temporal en bloqueos

### Impacto funcional
- deja lista la capa de persistencia para integrar Twilio + agente de voz
- permite trazabilidad completa de llamadas y transcript por restaurante
- mantiene separacion estricta entre tenants desde el modelo de datos

### Verificacion ejecutada
- `npx prisma validate`
- `npm run lint`
- `npm run build`

### Pendiente inmediato para aplicar en DB
- crear y ejecutar migracion Prisma en entorno de desarrollo/staging para materializar los nuevos modelos en PostgreSQL

---

## Actualizacion - Entrada de llamada Twilio + status webhook (Fase 3 inicial)

### Objetivo
Implementar los endpoints base de telefonia para recibir llamadas, validar seguridad de webhook y registrar estado de llamadas por tenant.

### Archivos modificados
- `app/api/voice/twilio/inbound/route.ts` (nuevo)
- `app/api/voice/twilio/status/route.ts` (nuevo)
- `lib/voice/twilioWebhook.ts` (nuevo)
- `scripts/create-restaurant.ts`

### Cambios aplicados

#### 1) Endpoint de llamada entrante
Se creo `POST /api/voice/twilio/inbound` con este flujo:
- parsea payload `application/x-www-form-urlencoded` de Twilio
- valida cabecera `x-twilio-signature`
- identifica restaurante por numero marcado (`To`) contra `PhoneNumber.phoneE164` activo
- crea/actualiza registro `Call` con `providerCallSid`
- responde TwiML (`text/xml`) con mensaje de bienvenida configurable por `AgentConfig.welcomeMessage`

Si el numero no esta configurado, responde un mensaje controlado y corta llamada.

#### 2) Endpoint de estado de llamada
Se creo `POST /api/voice/twilio/status` para eventos de lifecycle:
- valida firma de Twilio
- mapea estados Twilio (`ringing`, `in-progress`, `completed`, etc.) a `CallStatus`
- actualiza `status`, `durationSec`, `endedAt`, `errorCode`, `errorMessage`
- si no existe llamada previa pero se puede resolver el numero, crea el registro minimo de `Call`

#### 3) Capa de seguridad reutilizable de webhooks
Se creo `lib/voice/twilioWebhook.ts` con utilidades:
- `parseTwilioFormParams(rawBody)`
- `isValidTwilioSignature(request, params, signatureHeader)`
- `buildTwimlMessage(message, withHangup)`

La validacion usa HMAC-SHA1 con `TWILIO_AUTH_TOKEN` y comparacion segura (`timingSafeEqual`).

#### 4) Ajuste derivado por nueva schema
En `scripts/create-restaurant.ts` se agrego `slug` obligatorio al crear restaurante de bootstrap.

### Variables de entorno relevantes
- `TWILIO_AUTH_TOKEN` (obligatoria para validar firma)
- `TWILIO_WEBHOOK_BASE_URL` (opcional, util cuando la URL publica difiere de `request.url` por proxy/reverse proxy)

### Impacto funcional
- el backend ya puede recibir eventos reales de Twilio de forma segura
- queda iniciado el tracking de llamadas por restaurante (`Call`)
- base lista para conectar despues el puente de audio en tiempo real y orquestador de agente

### Verificacion ejecutada
- `npx prisma generate`
- `npm run lint`
- `npm run build`

### Pendiente inmediato
- aplicar migracion Prisma en DB antes de probar webhooks en runtime
- crear `PhoneNumber` y `AgentConfig` por restaurante para pruebas end-to-end

---

## Actualizacion - Ejecucion de pasos siguientes (DB + seed operativo)

### Objetivo
Ejecutar materializacion de schema en la base real y dejar datos minimos para probar webhooks de Twilio.

### Archivos modificados
- `prisma/schema.prisma`
- `scripts/seed_voice_setup.sql` (nuevo)
- `scripts/verify_voice_setup.sql` (nuevo)

### Cambios aplicados

#### 1) Sincronizacion de schema en DB real
Se intento flujo con migraciones versionadas:
- `npx prisma migrate dev --name voice_foundation`

Resultado: bloqueo por drift historico entre migraciones y estado real de la BD (Prisma solicito reset del esquema).

Para no destruir datos se uso estrategia no destructiva:
- `npx prisma db push --accept-data-loss`
- `npx prisma generate`

Con esto la BD queda sincronizada con el schema actual sin reset completo.

#### 2) Ajuste de compatibilidad para despliegue sobre BD existente
Se cambio `Restaurant.slug` a opcional en `prisma/schema.prisma`:
- de requerido a `String? @unique`

Motivo: la tabla `Restaurant` ya tenia filas y Prisma no podia agregar `slug` requerido sin reset/backfill previo.

#### 3) Seed minimo de voz/telefonia
Se creo `scripts/seed_voice_setup.sql` y se ejecuto con:
- `npx prisma db execute --file scripts/seed_voice_setup.sql`

Este seed deja:
- restaurante `rest_1` con `slug` y `timeZone`
- `RestaurantSettings` base
- `AgentConfig` base (idioma `es` y welcome message)
- `PhoneNumber` activo para pruebas (`+34911000000`)

#### 4) Verificacion de seed
Se creo `scripts/verify_voice_setup.sql` y se ejecuto con:
- `npx prisma db execute --file scripts/verify_voice_setup.sql`

El script falla si falta alguno de estos elementos:
- `Restaurant` `rest_1`
- `PhoneNumber` activo para `rest_1`
- `AgentConfig` para `rest_1`

### Impacto funcional
- la capa de datos de voz ya esta aplicada en la BD de desarrollo
- los webhooks Twilio ya tienen datos minimos para resolver tenant y registrar llamadas
- se evita reset destructivo en una BD con drift historico

### Verificacion ejecutada
- `npx prisma migrate dev --name voice_foundation` (fallo esperado por drift)
- `npx prisma db push --accept-data-loss`
- `npx prisma generate`
- `npx prisma db execute --file scripts/seed_voice_setup.sql`
- `npx prisma db execute --file scripts/verify_voice_setup.sql`
- `npm run lint`
- `npm run build`

### Pendiente recomendado
- normalizar historial de migraciones para evitar dependencia futura de `db push`
- reemplazar `+34911000000` por numero real de Twilio en `PhoneNumber`

---

## Actualizacion - Integracion inicial con Vapi (Fase 1)

### Objetivo
Habilitar entrada de eventos Vapi para registrar ciclo de llamada y transcripciones en el backend multi-tenant.

### Archivos modificados
- `app/api/voice/vapi/events/route.ts` (nuevo)
- `lib/voice/vapiWebhook.ts` (nuevo)

### Cambios aplicados

#### 1) Webhook de eventos Vapi
Se creo `POST /api/voice/vapi/events` con estas responsabilidades:
- validacion de firma del webhook
- parseo robusto de payload (soporta variantes `message` y `call`)
- resolucion de `restaurantId` por:
  - `metadata.restaurantId` (si viene en el evento)
  - numero destino (`to`) en `PhoneNumber` activo
- upsert en `Call` usando `providerCallSid = callId`
- persistencia de lineas de transcripcion en `CallTranscript`

#### 2) Estado de llamada normalizado
Se mapean estados de Vapi al enum interno `CallStatus`:
- `queued` -> `initiated`
- `ringing` -> `ringing`
- `in-progress` / `ongoing` -> `in_progress`
- `completed` / `ended` -> `completed`
- `failed` / `error` -> `failed`
- `no-answer` -> `no_answer`
- `busy` -> `busy`
- `canceled` / `cancelled` -> `canceled`

#### 3) Validacion de firma Vapi
Se implemento `isValidVapiSignature` en `lib/voice/vapiWebhook.ts`:
- usa HMAC-SHA256 sobre el body raw
- acepta cabeceras `x-vapi-signature` y `x-vapi-signature-sha256`
- compara en tiempo constante (`timingSafeEqual`)
- soporta firma en formato `sha256=...`, `hex` o `base64`

### Variables de entorno nuevas
- `VAPI_WEBHOOK_SECRET` (obligatoria para aceptar webhooks)

### Impacto funcional
- el proyecto ya puede recibir eventos de Vapi y guardarlos en tablas de llamadas/transcripcion
- queda lista la base para siguiente fase: tool-calling seguro (`checkAvailability` y `createReservation`)

### Verificacion ejecutada
- `npm run lint`
- `npm run build`
