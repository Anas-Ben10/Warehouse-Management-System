import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { itemsRouter } from "./routes/items.js";
import { locationsRouter } from "./routes/locations.js";
import { inventoryRouter } from "./routes/inventory.js";
import { transactionsRouter } from "./routes/transactions.js";
import { reportsRouter } from "./routes/reports.js";
import { syncRouter } from "./routes/sync.js";

const app = express();
const PORT = Number(process.env.PORT || 8080);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/items", itemsRouter);
app.use("/api/locations", locationsRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/sync", syncRouter);

app.listen(PORT, () => {
  console.log(`✅ API listening on http://0.0.0.0:${PORT}`);
});
