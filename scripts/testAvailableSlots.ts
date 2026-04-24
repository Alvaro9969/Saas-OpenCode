import "dotenv/config";
import { getAvailableTimeSlots } from "../services/getAvailableTimeSlots";

async function main() {
  const slots = await getAvailableTimeSlots(
    "rest_1",
    new Date("2026-04-22T00:00:00")
  );

  console.log(slots);
}

main().catch(console.error);