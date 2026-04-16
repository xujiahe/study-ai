import { Router, type IRouter } from "express";
import { streamChatHandler } from "../controllers/chat.controller.js";

const router: IRouter = Router();

// POST /api/chat/stream - 发起流式对话
router.post("/stream", streamChatHandler);

export default router;
