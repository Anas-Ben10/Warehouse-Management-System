import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

const prisma = new PrismaClient();
export const inventoryRouter = Router();

/**
 * GET /api/inventory/stock
 * - ADMIN: all stocks
 * - MANAGER/STAFF: only stocks in their division (location.divisionId)
 */
inventoryRouter.get("/stock", requireAuth, async (req: AuthedRequest, res) => {
  const role = req.user!.role;
  const divisionId = req.user!.divisionId;

  const where: any = {};
  if (role !== "ADMIN" && divisionId) {
    where.location = { divisionId };
  }

  const stocks = await prisma.stock.findMany({
    where,
    include: { item: true, location: true },
    orderBy: { updatedAt: "desc" },
  });

  res.json(
    stocks.map((s) => ({
      id: s.id,
      itemId: s.itemId,
      locationId: s.locationId,
      qty: s.qty,
      updatedAt: s.updatedAt,
      item: {
        id: s.item.id,
        sku: s.item.sku,
        name: s.item.name,
        barcode: s.item.barcode,
        reorderLevel: s.item.reorderLevel,
      },
      location: {
        id: s.location.id,
        code: s.location.code,
        name: s.location.name,
        divisionId: (s.location as any).divisionId ?? null,
        kind: (s.location as any).kind ?? "WAREHOUSE",
      },
    }))
  );
});
