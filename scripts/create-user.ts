import "dotenv/config";
import { hash } from "bcryptjs";
import { prisma } from "../lib/prisma";

async function main() {
  const existingUser = await prisma.user.findUnique({
    where: {
      email: "admin@demo.com",
    },
  });

  if (existingUser) {
    console.log("El usuario ya existe:", existingUser.email);
    return;
  }

  const passwordHash = await hash("admin123456", 10);

  const user = await prisma.user.create({
    data: {
      email: "admin@demo.com",
      name: "Admin Demo",
      passwordHash,
      role: "owner",
      restaurantId: "rest_1",
    },
  });

  console.log("Usuario creado:");
  console.log(user);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });