/**
 * API Key 鉴权中间件
 *
 * 所有业务路由（/documents、/retrieve）均需在请求头携带：
 *   X-API-Key: <RAG_API_KEY>
 *
 * 鉴权失败返回 401 Unauthorized，不执行后续处理器。
 */
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
