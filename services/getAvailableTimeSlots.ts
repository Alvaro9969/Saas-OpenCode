import { prisma } from "../lib/prisma";
import { generateTimeSlots } from "./generateTimeSlots";
import { getReservationsByDate } from "./getReservationsByDate";

export async function getAvailableTimeSlots(
  restaurantId: string,
  date: Date
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

  if (!openingHours || openingHours.isClosed) {
    return [];
  }

  const allSlots = generateTimeSlots(
    openingHours.openTime,
    openingHours.closeTime
  );

  const settings = await prisma.restaurantSettings.findUnique({
    where: { restaurantId },
  });

  const duration = settings?.reservationDurationMin ?? 90;

  const reservations = await getReservationsByDate(restaurantId, date);

  return allSlots.filter((slot) => {
    const [slotHour, slotMinute] = slot.split(":").map(Number);

    const slotDate = new Date(date);
    slotDate.setHours(slotHour, slotMinute, 0, 0);

    return !reservations.some((reservation) => {
      const start = reservation.dateTime;

      const end = new Date(start);
      end.setMinutes(end.getMinutes() + duration);

      return slotDate >= start && slotDate < end;
    });
  });
}