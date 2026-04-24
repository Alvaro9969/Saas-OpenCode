import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const restaurantId = "rest_1";

  const data = [
    { dayOfWeek: 0, openTime: "13:00", closeTime: "23:00", isClosed: false },
    { dayOfWeek: 1, openTime: "13:00", closeTime: "23:00", isClosed: false },
    { dayOfWeek: 2, openTime: "13:00", closeTime: "23:00", isClosed: false },
    { dayOfWeek: 3, openTime: "13:00", closeTime: "23:00", isClosed: false },
    { dayOfWeek: 4, openTime: "13:00", closeTime: "23:00", isClosed: false },
    { dayOfWeek: 5, openTime: "13:00", closeTime: "23:00", isClosed: false },
    { dayOfWeek: 6, openTime: "13:00", closeTime: "23:00", isClosed: false },
  ];

  for (const item of data) {
    await prisma.openingHours.upsert({
      where: {
        restaurantId_dayOfWeek: {
          restaurantId,
          dayOfWeek: item.dayOfWeek,
        },
      },
      update: {
        openTime: item.openTime,
        closeTime: item.closeTime,
        isClosed: item.isClosed,
      },
      create: {
        restaurantId,
        dayOfWeek: item.dayOfWeek,
        openTime: item.openTime,
        closeTime: item.closeTime,
        isClosed: item.isClosed,
      },
    });
  }

  console.log("Opening hours seeded");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });