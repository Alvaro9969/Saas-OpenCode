import { NextRequest, NextResponse } from "next/server";
import { cancelReservation } from "@/services/cancelReservation";
import { getCurrentRestaurantIdFromRequest } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const restaurantId = await getCurrentRestaurantIdFromRequest(request);

    if (!id) {
      return NextResponse.json(
        { error: "Falta el id de la reserva" },
        { status: 400 }
      );
    }

    const result = await cancelReservation(id, restaurantId);

    if (!result.success) {
      const businessErrors = [
        "Reserva no encontrada",
        "La reserva ya está cancelada",
      ];

      const status = businessErrors.includes(result.error ?? "") ? 404 : 500;

      return NextResponse.json(
        { error: result.error },
        { status }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Error cancelando reserva:", error);

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (error instanceof Error && error.message === "RESTAURANT_CONTEXT_MISSING") {
      return NextResponse.json(
        { error: "Restaurant context missing" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "No se pudo cancelar la reserva" },
      { status: 500 }
    );
  }
}
