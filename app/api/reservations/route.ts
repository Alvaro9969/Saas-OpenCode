import { NextRequest, NextResponse } from "next/server";
import { createReservation } from "@/lib/reservations/createReservation";
import { getReservations } from "@/lib/reservations/getReservations";
import { getCurrentRestaurantIdFromRequest } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const reservationDate = new Date(body.dateTime);

    if (
      !body.restaurantId ||
      !body.customerName ||
      body.partySize <= 0 ||
      !body.dateTime ||
      isNaN(reservationDate.getTime())
    ) {
      return NextResponse.json(
        { error: "Datos inválidos" },
        { status: 400 }
      );
    }

    const result = await createReservation({
      restaurantId: body.restaurantId,
      customerName: body.customerName,
      phone: body.phone,
      dateTime: reservationDate,
      partySize: body.partySize,
    });

    if (!result.success) {
      const businessErrors = [
        "No hay disponibilidad para esa hora",
        "El restaurante está cerrado a esa hora",
        "La reserva debe ser en bloques de 30 minutos",
      ];

      const status = businessErrors.includes(result.error ?? "") ? 409 : 500;

      return NextResponse.json(
        { error: result.error },
        { status }
      );
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    console.error("Error al crear la reserva:", error);

    return NextResponse.json(
      { error: "No se pudo crear la reserva" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const restaurantId = await getCurrentRestaurantIdFromRequest(request);
    const reservations = await getReservations(restaurantId);

    return NextResponse.json(reservations);
  } catch (error) {
    console.error("Error al obtener las reservas:", error);

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "No se pudieron obtener las reservas" },
      { status: 500 }
    );
  }
}