import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentRestaurantIdFromRequest } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const restaurantId = await getCurrentRestaurantIdFromRequest(request);

    const settings = await prisma.restaurantSettings.findUnique({
      where: {
        restaurantId,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error obteniendo settings:", error);

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Error obteniendo settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const restaurantId = await getCurrentRestaurantIdFromRequest(request);
    const body = await request.json();

    const { maxGuestsPerSlot, reservationDurationMin } = body;

    if (
      typeof maxGuestsPerSlot !== "number" ||
      typeof reservationDurationMin !== "number"
    ) {
      return NextResponse.json(
        { error: "Datos inválidos" },
        { status: 400 }
      );
    }

    const updatedSettings = await prisma.restaurantSettings.update({
      where: {
        restaurantId,
      },
      data: {
        maxGuestsPerSlot,
        reservationDurationMin,
      },
    });

    return NextResponse.json(updatedSettings);
  } catch (error) {
    console.error("Error actualizando settings:", error);

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Error actualizando settings" },
      { status: 500 }
    );
  }
}