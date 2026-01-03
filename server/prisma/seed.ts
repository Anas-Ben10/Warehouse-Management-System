import { PrismaClient, Role, LocationKind } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  // ----- Ensure at least one division exists -----
  let division = await prisma.division.findFirst({ orderBy: { createdAt: "asc" } });
  if (!division) {
    division = await prisma.division.create({ data: { name: "Division A" } });
    console.log("✅ Seeded default division:", division.name);
  }

  // ----- Admin user -----
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
        isActive: true,
        divisionId: division.id,
      },
    });
    console.log("✅ Seeded admin:", email);
  } else {
    console.log("ℹ️ Admin already exists:", email);
  }

  // ----- Default locations -----
  const locCount = await prisma.location.count();
  if (locCount === 0) {
    await prisma.location.createMany({
      data: [
        { code: "RECEIVING", name: "Receiving", kind: LocationKind.WAREHOUSE, divisionId: division.id },
        { code: "SHIPPING", name: "Shipping", kind: LocationKind.WAREHOUSE, divisionId: division.id },
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
