import { Router, type IRouter } from "express";
import type { Request, Response } from "express";

const router: IRouter = Router();

// GET /api/health - 健康检查
router.get("/", (_req: Request, res: Response) => {
  res.json({ status: "ok", ts: Date.now() });
});

export default router;
