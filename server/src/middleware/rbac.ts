import type { Response, NextFunction } from "express";
import type { AuthedRequest } from "./auth.js";

export function requireRole(roles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}
