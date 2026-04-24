import { prisma } from "@/lib/prisma";

type CheckAvailabilityInput = {
  restaurantId: string;
  dateTime: Date;
  partySize: number;
};

export async function checkAvailability(data: CheckAvailabilityInput) {
  const settings = await prisma.restaurantSettings.findUnique({
    where: {
      restaurantId: data.restaurantId,
    },
  });

  if (!settings) {
    return {
      available: false,
      totalGuests: 0,
      maxGuestsPerSlot: 0,
    };
  }

  const reservationDurationMs = settings.reservationDurationMin * 60 * 1000;

  const newStart = new Date(data.dateTime);
  const newEnd = new Date(newStart.getTime() + reservationDurationMs);
  const windowStart = new Date(newStart.getTime() - reservationDurationMs);

  const reservations = await prisma.reservation.findMany({
    where: {
      restaurantId: data.restaurantId,
      status: "confirmed",
      dateTime: {
        gte: windowStart,
        lt: newEnd,
      },
    },
  });

  const totalGuests = reservations.reduce((sum, reservation) => {
    return sum + reservation.partySize;
  }, 0);

  const available =
    totalGuests + data.partySize <= settings.maxGuestsPerSlot;

  return {
    available,
    totalGuests,
    maxGuestsPerSlot: settings.maxGuestsPerSlot,
  };
}