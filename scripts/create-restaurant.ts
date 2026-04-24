import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  // Crear restaurante
  await prisma.restaurant.create({
    data: {
      id: "rest_1",
      name: "Mi Restaurante",
      slug: "mi-restaurante",
    },
  });

  // Crear settings
  await prisma.restaurantSettings.create({
    data: {
      restaurantId: "rest_1",
      maxGuestsPerSlot: 5,
      reservationDurationMin: 90,
    },
  });

  console.log("Setup completado");
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
