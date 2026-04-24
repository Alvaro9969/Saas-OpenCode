import { prisma } from "@/lib/prisma";

export async function getReservations(restaurantId: string) {
  const reservations = await prisma.reservation.findMany({
    where: {
      restaurantId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return reservations;
}