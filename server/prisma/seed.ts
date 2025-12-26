import { PrismaClient, Role } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@local.test";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const passwordHash = await argon2.hash("ChangeMe!12345", { type: argon2.argon2id });
    await prisma.user.create({
      data: {
        email,
        name: "Local Admin",
        role: Role.ADMIN,
        passwordHash,
      },
    });
    console.log("✅ Seeded admin:", email);
  } else {
    console.log("ℹ️ Admin already exists:", email);
  }

  // Create a couple default locations if none exist
  const locCount = await prisma.location.count();
  if (locCount === 0) {
    await prisma.location.createMany({
      data: [
        { code: "RECEIVING", name: "Receiving" },
        { code: "SHIPPING", name: "Shipping" },
      ],
    });
    console.log("✅ Seeded default locations");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
