import { Router, type IRouter } from "express";
import {
  createSession,
  listSessions,
  getSession,
  deleteSession,
  getSessionMessagesHandler,
} from "../controllers/session.controller.js";

const router: IRouter = Router();

// POST /api/sessions - 创建新 Session
router.post("/", createSession);

// GET /api/sessions - 获取 Session 列表（倒序）
router.get("/", listSessions);

// GET /api/sessions/:id - 获取单个 Session
router.get("/:id", getSession);

// DELETE /api/sessions/:id - 删除 Session 及其消息
router.delete("/:id", deleteSession);

// GET /api/sessions/:id/messages - 获取 Session 消息历史（升序）
router.get("/:id/messages", getSessionMessagesHandler);

export default router;
