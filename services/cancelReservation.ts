import { prisma } from "../lib/prisma";

export async function cancelReservation(
  reservationId: string,
  restaurantId: string
) {
  const reservation = await prisma.reservation.findFirst({
    where: {
      id: reservationId,
      restaurantId,
    },
  });

  if (!reservation) {
    return {
      success: false,
      error: "Reserva no encontrada",
    };
  }

  if (reservation.status === "cancelled") {
    return {
      success: false,
      error: "La reserva ya está cancelada",
    };
  }

  const updatedReservation = await prisma.reservation.update({
    where: {
      id: reservationId,
    },
    data: {
      status: "cancelled",
    },
  });

  return {
    success: true,
    data: updatedReservation,
  };
}