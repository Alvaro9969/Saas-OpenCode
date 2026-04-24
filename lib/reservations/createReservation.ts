import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { Reservation } from "@prisma/client";
import { isValidTimeSlot } from "../../services/isValidTimeSlot";

type CreateReservationInput = {
  restaurantId: string;
  customerName: string;
  phone?: string;
  dateTime: Date;
  partySize: number;
};

type CreateReservationResult =
  | {
      success: true;
      data: Reservation;
    }
  | {
      success: false;
      error: string;
    };

function reservationError(error: string): CreateReservationResult {
  return {
    success: false,
    error,
  };
}

function reservationSuccess(data: Reservation): CreateReservationResult {
  return {
    success: true,
    data,
  };
}

export async function createReservation(
  data: CreateReservationInput
): Promise<CreateReservationResult> {
  try {
    const now = new Date();

    if (data.partySize <= 0 || !Number.isInteger(data.partySize)) {
      return reservationError("No se pudo crear la reserva");
    }

    if (data.dateTime < now) {
      return reservationError("No se pueden crear reservas en el pasado");
    }

    const validTimeSlot = isValidTimeSlot(data.dateTime);

    if (!validTimeSlot) {
      return reservationError("La reserva debe ser en bloques de 30 minutos");
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const settings = await tx.restaurantSettings.findUnique({
          where: {
            restaurantId: data.restaurantId,
          },
        });

        if (!settings) {
          return reservationError("No se pudo crear la reserva");
        }

        if (data.partySize > settings.maxGuestsPerSlot) {
          return reservationError("No hay disponibilidad para esa hora");
        }

        const reservationDurationMs = settings.reservationDurationMin * 60 * 1000;
        const newStart = new Date(data.dateTime);
        const newEnd = new Date(newStart.getTime() + reservationDurationMs);

        const dayOfWeek = newStart.getDay();
        const openingHours = await tx.openingHours.findUnique({
          where: {
            restaurantId_dayOfWeek: {
              restaurantId: data.restaurantId,
              dayOfWeek,
            },
          },
        });

        if (!openingHours || openingHours.isClosed) {
          return reservationError("El restaurante está cerrado a esa hora");
        }

        const [openHour, openMinute] = openingHours.openTime.split(":").map(Number);
        const [closeHour, closeMinute] = openingHours.closeTime
          .split(":")
          .map(Number);

        const openMinutes = openHour * 60 + openMinute;
        const closeMinutes = closeHour * 60 + closeMinute;
        const newStartMinutes = newStart.getHours() * 60 + newStart.getMinutes();
        const newEndMinutes = newEnd.getHours() * 60 + newEnd.getMinutes();

        if (newStartMinutes < openMinutes || newEndMinutes > closeMinutes) {
          return reservationError("El restaurante está cerrado a esa hora");
        }

        const candidateWindowStart = new Date(newStart.getTime() - reservationDurationMs);
        const existingReservations = await tx.reservation.findMany({
          where: {
            restaurantId: data.restaurantId,
            status: "confirmed",
            dateTime: {
              gte: candidateWindowStart,
              lt: newEnd,
            },
          },
        });

        const overlappingGuests = existingReservations.reduce((sum, reservation) => {
          const existingStart = reservation.dateTime;
          const existingEnd = new Date(existingStart.getTime() + reservationDurationMs);

          const overlaps = existingStart < newEnd && existingEnd > newStart;

          return overlaps ? sum + reservation.partySize : sum;
        }, 0);

        if (overlappingGuests + data.partySize > settings.maxGuestsPerSlot) {
          return reservationError("No hay disponibilidad para esa hora");
        }

        const reservation = await tx.reservation.create({
          data: {
            restaurantId: data.restaurantId,
            customerName: data.customerName,
            phone: data.phone,
            dateTime: newStart,
            partySize: data.partySize,
            status: "confirmed",
          },
        });

        return reservationSuccess(reservation);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    return result;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return reservationError("No hay disponibilidad para esa hora");
    }

    console.error("ERROR createReservation:", error);

    return reservationError("No se pudo crear la reserva");
  }
}
