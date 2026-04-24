import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function getCurrentRestaurantIdFromRequest(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    throw new Error("UNAUTHORIZED");
  }

  const restaurantId = token.restaurantId as string | undefined;

  if (!restaurantId) {
    throw new Error("RESTAURANT_CONTEXT_MISSING");
  }

  return restaurantId;
}