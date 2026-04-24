import { NextRequest, NextResponse } from "next/server";
import { getReservationsByDate } from "@/services/getReservationsByDate";
import { getAvailableTimeSlots } from "@/services/getAvailableTimeSlots";
import { getCurrentRestaurantIdFromRequest } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");

    if (!dateParam) {
      return NextResponse.json(
        { error: "Falta la fecha" },
        { status: 400 }
      );
    }

    const date = new Date(dateParam);

    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { error: "Fecha inválida" },
        { status: 400 }
      );
    }

    const restaurantId = await getCurrentRestaurantIdFromRequest(request);

    const reservations = await getReservationsByDate(restaurantId, date);
    const slots = await getAvailableTimeSlots(restaurantId, date);

    return NextResponse.json({
      restaurantId,
      date: dateParam,
      reservations,
      slots,
    });
  } catch (error) {
    console.error("Error obteniendo detalle diario:", error);

    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }

      if (error.message === "RESTAURANT_CONTEXT_MISSING") {
        return NextResponse.json(
          { error: "Restaurant context missing" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "No se pudo obtener el detalle diario" },
      { status: 500 }
    );
  }
}