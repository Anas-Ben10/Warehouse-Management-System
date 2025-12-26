import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

const prisma = new PrismaClient();
export const syncRouter = Router();

/**
 * Offline outbox push:
 * - Client sends operations with unique id (opId)
 * - Server dedupes by SyncOp table (id = opId)
 */
const pushSchema = z.object({
  ops: z.array(z.object({
    id: z.string().min(1),
    kind: z.enum(["ITEM_UPSERT","ITEM_DELETE","LOC_UPSERT","LOC_DELETE","TXN_CREATE"]),
    payload: z.any(),
  })),
});

syncRouter.post("/push", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = pushSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const results: any[] = [];
  for (const op of parsed.data.ops) {
    const seen = await prisma.syncOp.findUnique({ where: { id: op.id } });
    if (seen) {
      results.push({ id: op.id, status: "skipped" });
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.syncOp.create({ data: { id: op.id, userId: req.user!.id } });

      if (op.kind === "ITEM_UPSERT") {
        const p = op.payload as any;
        await tx.item.upsert({
          where: { id: p.id || "__nope__" },
          create: { sku: p.sku, name: p.name, barcode: p.barcode || null, reorderLevel: p.reorderLevel ?? 0 },
          update: { sku: p.sku, name: p.name, barcode: p.barcode || null, reorderLevel: p.reorderLevel ?? 0, isDeleted: false },
        }).catch(async () => {
          // fallback by sku if id wasn't set
          await tx.item.upsert({
            where: { sku: p.sku },
            create: { sku: p.sku, name: p.name, barcode: p.barcode || null, reorderLevel: p.reorderLevel ?? 0 },
            update: { name: p.name, barcode: p.barcode || null, reorderLevel: p.reorderLevel ?? 0, isDeleted: false },
          });
        });
      }

      if (op.kind === "ITEM_DELETE") {
        const p = op.payload as any;
        if (p.id) await tx.item.update({ where: { id: p.id }, data: { isDeleted: true } }).catch(() => {});
      }

      if (op.kind === "LOC_UPSERT") {
        const p = op.payload as any;
        await tx.location.upsert({
          where: { id: p.id || "__nope__" },
          create: { code: p.code, name: p.name },
          update: { code: p.code, name: p.name, isDeleted: false },
        }).catch(async () => {
          await tx.location.upsert({
            where: { code: p.code },
            create: { code: p.code, name: p.name },
            update: { name: p.name, isDeleted: false },
          });
        });
      }

      if (op.kind === "LOC_DELETE") {
        const p = op.payload as any;
        if (p.id) await tx.location.update({ where: { id: p.id }, data: { isDeleted: true } }).catch(() => {});
      }

      if (op.kind === "TXN_CREATE") {
        const p = op.payload as any;
        // route logic already handles idempotency via offlineOpId
        await tx.transaction.create({
          data: {
            offlineOpId: p.offlineOpId,
            type: p.type,
            itemId: p.itemId,
            qty: p.qty,
            srcLocationId: p.srcLocationId ?? null,
            dstLocationId: p.dstLocationId ?? null,
            note: p.note ?? null,
            createdById: req.user!.id,
          },
        }).catch(() => {});
      }
    });

    results.push({ id: op.id, status: "applied" });
  }

  res.json({ ok: true, results });
});

/**
 * Pull updated data since a timestamp (ms since epoch).
 */
syncRouter.get("/pull", requireAuth, async (req, res) => {
  const sinceMs = Number(req.query.since || 0);
  const since = new Date(isFinite(sinceMs) && sinceMs > 0 ? sinceMs : 0);

  const [items, locations, stocks, txns] = await Promise.all([
    prisma.item.findMany({ where: { updatedAt: { gt: since } } }),
    prisma.location.findMany({ where: { updatedAt: { gt: since } } }),
    prisma.stock.findMany({ where: { updatedAt: { gt: since } } }),
    prisma.transaction.findMany({ where: { createdAt: { gt: since } }, orderBy: { createdAt: "desc" }, take: 500 }),
  ]);

  res.json({ now: Date.now(), items, locations, stocks, txns });
});
