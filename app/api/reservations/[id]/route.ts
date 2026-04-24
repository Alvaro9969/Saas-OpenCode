import { prisma } from "@/lib/prisma";
import { getCurrentRestaurantIdFromRequest } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const restaurantId = await getCurrentRestaurantIdFromRequest(request);

    const reservation = await prisma.reservation.findFirst({
      where: {
        id,
        restaurantId,
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reserva no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(reservation);
  } catch (error) {
    console.error("Error al obtener la reserva:", error);

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
      { error: "Error al obtener la reserva" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const restaurantId = await getCurrentRestaurantIdFromRequest(request);

    const reservation = await prisma.reservation.findFirst({
      where: {
        id,
        restaurantId,
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reserva no encontrada" },
        { status: 404 }
      );
    }

    await prisma.reservation.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({ message: "Reserva eliminada" });
  } catch (error) {
    console.error("Error al eliminar la reserva:", error);

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
      { error: "Error al eliminar la reserva" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const restaurantId = await getCurrentRestaurantIdFromRequest(request);

    const reservation = await prisma.reservation.findFirst({
      where: {
        id,
        restaurantId,
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reserva no encontrada" },
        { status: 404 }
      );
    }

    const updatedReservation = await prisma.reservation.update({
      where: {
        id,
      },
      data: {
        status: body.status,
      },
    });

    return NextResponse.json(updatedReservation);
  } catch (error) {
    console.error("Error al actualizar la reserva:", error);

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
      { error: "Error al actualizar la reserva" },
      { status: 500 }
    );
  }
}
