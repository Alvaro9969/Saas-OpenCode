import { prisma } from "../lib/prisma";

export async function isWithinOpeningHours(
  date: Date,
  restaurantId: string
) {
  const dayOfWeek = date.getDay();

  const openingHours = await prisma.openingHours.findUnique({
    where: {
      restaurantId_dayOfWeek: {
        restaurantId,
        dayOfWeek,
      },
    },
  });

  if (!openingHours) {
  console.error("OpeningHours no encontrado para:", restaurantId, dayOfWeek);
  return false;
}
  if (openingHours.isClosed) return false;

  const reservationMinutes = date.getHours() * 60 + date.getMinutes();

  const [openH, openM] = openingHours.openTime.split(":").map(Number);
  const [closeH, closeM] = openingHours.closeTime.split(":").map(Number);

  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  return reservationMinutes >= openMinutes && reservationMinutes < closeMinutes;
}