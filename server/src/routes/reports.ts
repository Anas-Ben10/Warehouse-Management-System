import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";

const prisma = new PrismaClient();
export const reportsRouter = Router();

// Simple low stock: sum across locations < reorderLevel
reportsRouter.get("/low-stock", requireAuth, async (_req, res) => {
  const items = await prisma.item.findMany({ where: { isDeleted: false } });
  const stocks = await prisma.stock.findMany();

  const totals = new Map<string, number>();
  for (const s of stocks) totals.set(s.itemId, (totals.get(s.itemId) || 0) + s.qty);

  const low = items
    .map(i => ({ itemId: i.id, sku: i.sku, name: i.name, reorderLevel: i.reorderLevel, totalQty: totals.get(i.id) || 0 }))
    .filter(r => r.totalQty < r.reorderLevel)
    .sort((a,b) => a.totalQty - b.totalQty);

  res.json(low);
});
