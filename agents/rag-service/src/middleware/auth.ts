import type { Request, Response, NextFunction } from "express";
import type { Config } from "../config.js";

export function apiKeyAuth(config: Config) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.headers["x-api-key"];
    if (!key || key !== config.apiKey) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  };
}
