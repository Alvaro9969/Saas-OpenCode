DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "Restaurant"
    WHERE "id" = 'rest_1'
  ) THEN
    RAISE EXCEPTION 'Restaurant rest_1 not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "PhoneNumber"
    WHERE "restaurantId" = 'rest_1'
      AND "isActive" = true
  ) THEN
    RAISE EXCEPTION 'Active phone number for rest_1 not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "AgentConfig"
    WHERE "restaurantId" = 'rest_1'
  ) THEN
    RAISE EXCEPTION 'AgentConfig for rest_1 not found';
  END IF;
END $$;
