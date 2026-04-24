import { NextResponse } from "next/server";
import { getAvailableTimeSlots } from "@/services/getAvailableTimeSlots";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const dateParam = searchParams.get("date");
    const restaurantId = searchParams.get("restaurantId");

    if (!dateParam) {
      return NextResponse.json(
        { error: "Falta la fecha" },
        { status: 400 }
      );
    }

    if (!restaurantId) {
      return NextResponse.json(
        { error: "Falta restaurantId" },
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

    const slots = await getAvailableTimeSlots(restaurantId, date);

    return NextResponse.json({
      restaurantId,
      date: dateParam,
      slots,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Error obteniendo disponibilidad" },
      { status: 500 }
    );
  }
}