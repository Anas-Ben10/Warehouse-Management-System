import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";

const prisma = new PrismaClient();
export const inventoryRouter = Router();

inventoryRouter.get("/stock", requireAuth, async (_req, res) => {
  const stocks = await prisma.stock.findMany({
    include: { item: true, location: true },
    orderBy: { updatedAt: "desc" },
  });

  res.json(stocks.map(s => ({
    id: s.id,
    itemId: s.itemId,
    locationId: s.locationId,
    qty: s.qty,
    updatedAt: s.updatedAt,
    item: { id: s.item.id, sku: s.item.sku, name: s.item.name, barcode: s.item.barcode, reorderLevel: s.item.reorderLevel },
    location: { id: s.location.id, code: s.location.code, name: s.location.name }
  })));
});
