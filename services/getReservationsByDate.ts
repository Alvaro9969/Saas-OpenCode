import { prisma } from "../lib/prisma";

export async function getReservationsByDate(
  restaurantId: string,
  date: Date
) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return prisma.reservation.findMany({
    where: {
      restaurantId,
      status: {
        not: "cancelled",
      },
      dateTime: {
        gte: start,
        lte: end,
      },
    },
    orderBy: {
      dateTime: "asc",
    },
  });
}