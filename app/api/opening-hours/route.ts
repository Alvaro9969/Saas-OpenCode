import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentRestaurantIdFromRequest } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const restaurantId = await getCurrentRestaurantIdFromRequest(request);

    const openingHours = await prisma.openingHours.findMany({
      where: {
        restaurantId,
      },
      orderBy: {
        dayOfWeek: "asc",
      },
    });

    return NextResponse.json(openingHours);
  } catch (error) {
    console.error("Error obteniendo opening hours:", error);

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Error obteniendo opening hours" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const restaurantId = await getCurrentRestaurantIdFromRequest(request);
    const body = await request.json();

    if (!Array.isArray(body)) {
      return NextResponse.json(
        { error: "Formato inválido" },
        { status: 400 }
      );
    }

    for (const item of body) {
      if (
        typeof item.dayOfWeek !== "number" ||
        typeof item.openTime !== "string" ||
        typeof item.closeTime !== "string" ||
        typeof item.isClosed !== "boolean"
      ) {
        return NextResponse.json(
          { error: "Datos inválidos" },
          { status: 400 }
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.openingHours.deleteMany({
        where: {
          restaurantId,
        },
      });

      await tx.openingHours.createMany({
        data: body.map((item) => ({
          restaurantId,
          dayOfWeek: item.dayOfWeek,
          openTime: item.openTime,
          closeTime: item.closeTime,
          isClosed: item.isClosed,
        })),
      });
    });

    const updatedOpeningHours = await prisma.openingHours.findMany({
      where: {
        restaurantId,
      },
      orderBy: {
        dayOfWeek: "asc",
      },
    });

    return NextResponse.json(updatedOpeningHours);
  } catch (error) {
    console.error("Error actualizando opening hours:", error);

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Error actualizando opening hours" },
      { status: 500 }
    );
  }
}