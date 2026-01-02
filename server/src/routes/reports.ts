import { Router } from "express";
import { PrismaClient, Role } from "@prisma/client";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

const prisma = new PrismaClient();
export const reportsRouter = Router();

// Simple low stock: sum across locations < reorderLevel
reportsRouter.get("/low-stock", requireAuth, async (_req, res) => {
  const items = await prisma.item.findMany({ where: { isDeleted: false } });
  const stocks = await prisma.stock.findMany();

  const totals = new Map<string, number>();
  for (const s of stocks) {
    totals.set(s.itemId, (totals.get(s.itemId) || 0) + s.qty);
  }

  const low = items
    .map((i) => ({
      itemId: i.id,
      sku: i.sku,
      name: i.name,
      reorderLevel: i.reorderLevel,
      totalQty: totals.get(i.id) || 0,
    }))
    .filter((r) => r.totalQty < r.reorderLevel)
    .sort((a, b) => a.totalQty - b.totalQty);

  res.json(low);
});

/**
 * KPIs + activity
 * - ADMIN: sees all
 * - MANAGER: sees only STAFF in their division
 */
reportsRouter.get("/kpis", requireAuth, async (req: AuthedRequest, res) => {
  const me = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { role: true, divisionId: true },
  });

  const role = me?.role as Role | undefined;
  if (!role) return res.status(401).json({ error: "Unauthorized" });

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Managers only see STAFF in their own division
  const staffScopeUserWhere =
    role === Role.MANAGER
      ? {
          role: Role.STAFF,
          isActive: true,
          divisionId: me?.divisionId ?? "__NONE__",
        }
      : undefined;

  const txnWhere24h =
    role === Role.MANAGER
      ? { createdAt: { gte: since24h }, createdBy: { is: staffScopeUserWhere } }
      : { createdAt: { gte: since24h } };

  const txnWhere7d =
    role === Role.MANAGER
      ? { createdAt: { gte: since7d }, createdBy: { is: staffScopeUserWhere } }
      : { createdAt: { gte: since7d } };

  const [itemsCount, locationsCount, stockAgg, tx24h, tx7d] = await Promise.all([
    prisma.item.count({ where: { isDeleted: false } }),
    prisma.location.count({ where: { isDeleted: false } }),
    prisma.stock.aggregate({ _sum: { qty: true } }),
    prisma.transaction.count({ where: txnWhere24h }),
    prisma.transaction.count({ where: txnWhere7d }),
  ]);

  // Top performers (MANAGER only) by tx count in last 7 days
  // NOTE: Count `id` instead of `_all` to satisfy Prisma TS types.
  const top =
    role === Role.MANAGER
      ? await prisma.transaction.groupBy({
          by: ["createdById"],
          where: txnWhere7d,
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: 10,
        })
      : [];

  const topUsers = top.length
    ? await prisma.user.findMany({
        where: { id: { in: top.map((t) => t.createdById) } },
        select: { id: true, name: true, email: true },
      })
    : [];

  const topMerged = top.map((t) => ({
    user:
      topUsers.find((u) => u.id === t.createdById) ?? {
        id: t.createdById,
        name: "Unknown",
        email: "",
      },
    txCount7d: t._count.id,
  }));

  return res.json({
    itemsCount,
    locationsCount,
    totalStockQty: stockAgg._sum.qty ?? 0,
    txCount24h: tx24h,
    txCount7d: tx7d,
    topPerformers7d: topMerged,
  });
});

reportsRouter.get("/activity", requireAuth, async (req: AuthedRequest, res) => {
  const me = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { role: true, divisionId: true },
  });

  const role = me?.role as Role | undefined;
  if (!role) return res.status(401).json({ error: "Unauthorized" });

  const staffScopeUserWhere =
    role === Role.MANAGER
      ? {
          role: Role.STAFF,
          isActive: true,
          divisionId: me?.divisionId ?? "__NONE__",
        }
      : undefined;

  const where =
    role === Role.MANAGER
      ? { createdBy: { is: staffScopeUserWhere } }
      : undefined;

  const activity = await prisma.transaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      item: true,
      createdBy: { select: { id: true, name: true, email: true, role: true, divisionId: true } },
      srcLocation: true,
      dstLocation: true,
    },
  });

  return res.json(
    activity.map((t) => ({
      id: t.id,
      type: t.type,
      qty: t.qty,
      note: t.note,
      isFree: t.isFree,
      unitPrice: t.unitPrice ? t.unitPrice.toString() : null, // important for JSON
      createdAt: t.createdAt,
      item: { id: t.item.id, sku: t.item.sku, name: t.item.name, barcode: t.item.barcode },
      createdBy: t.createdBy,
      srcLocation: t.srcLocation ? { id: t.srcLocation.id, code: t.srcLocation.code } : null,
      dstLocation: t.dstLocation ? { id: t.dstLocation.id, code: t.dstLocation.code } : null,
    }))
  );
});
