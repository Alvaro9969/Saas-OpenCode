INSERT INTO "Restaurant" (
  "id",
  "name",
  "slug",
  "timeZone",
  "createdAt",
  "updatedAt"
)
VALUES (
  'rest_1',
  'Mi Restaurante',
  'mi-restaurante',
  'Europe/Madrid',
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "slug" = COALESCE("Restaurant"."slug", EXCLUDED."slug"),
  "timeZone" = COALESCE("Restaurant"."timeZone", EXCLUDED."timeZone"),
  "updatedAt" = NOW();

INSERT INTO "RestaurantSettings" (
  "id",
  "restaurantId",
  "maxGuestsPerSlot",
  "reservationDurationMin",
  "createdAt",
  "updatedAt"
)
VALUES (
  'rest_settings_1',
  'rest_1',
  10,
  90,
  NOW(),
  NOW()
)
ON CONFLICT ("restaurantId") DO UPDATE
SET
  "updatedAt" = NOW();

INSERT INTO "AgentConfig" (
  "id",
  "restaurantId",
  "language",
  "assistantName",
  "welcomeMessage",
  "sameDayReservationsEnabled",
  "handoffToHumanEnabled",
  "createdAt",
  "updatedAt"
)
VALUES (
  'agent_config_1',
  'rest_1',
  'es',
  'Asistente de reservas',
  'Hola, gracias por llamar. Soy el asistente de reservas de Mi Restaurante.',
  true,
  false,
  NOW(),
  NOW()
)
ON CONFLICT ("restaurantId") DO UPDATE
SET
  "language" = EXCLUDED."language",
  "assistantName" = EXCLUDED."assistantName",
  "welcomeMessage" = EXCLUDED."welcomeMessage",
  "sameDayReservationsEnabled" = EXCLUDED."sameDayReservationsEnabled",
  "handoffToHumanEnabled" = EXCLUDED."handoffToHumanEnabled",
  "updatedAt" = NOW();

INSERT INTO "PhoneNumber" (
  "id",
  "restaurantId",
  "provider",
  "phoneE164",
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES (
  'phone_rest_1',
  'rest_1',
  'twilio',
  '+34911000000',
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("phoneE164") DO UPDATE
SET
  "restaurantId" = EXCLUDED."restaurantId",
  "provider" = EXCLUDED."provider",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = NOW();
