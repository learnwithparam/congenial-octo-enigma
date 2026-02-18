import { Router, Request, Response } from "express";
import type { ApiResponse } from "../types.js";

const router = Router();

router.get("/", (_req: Request, res: Response<ApiResponse>) => {
  res.json({
    success: true,
    data: {
      status: "healthy",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    },
  });
});

export default router;
