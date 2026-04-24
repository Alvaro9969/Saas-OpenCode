import "dotenv/config";
import { getReservationsByDate } from "../services/getReservationsByDate";

async function main() {
  const reservations = await getReservationsByDate(
    "rest_1",
    new Date("2026-04-22T00:00:00")
  );

  console.log(reservations);
}

main().catch(console.error); 