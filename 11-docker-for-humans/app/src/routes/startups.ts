import { Router, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import type { Startup, CreateStartupInput, UpdateStartupInput, ApiResponse } from "../types.js";

const router = Router();

// In-memory store
const startups: Map<string, Startup> = new Map();

// Seed some data
const seeds: CreateStartupInput[] = [
  {
    name: "CloudKitchen",
    description: "AI-powered ghost kitchen platform",
    industry: "FoodTech",
    founded: 2023,
  },
  {
    name: "GreenRoute",
    description: "Carbon-neutral last-mile delivery",
    industry: "Logistics",
    founded: 2022,
  },
];

for (const seed of seeds) {
  const id = randomUUID();
  const now = new Date().toISOString();
  startups.set(id, { id, ...seed, createdAt: now, updatedAt: now });
}

// GET /api/startups
router.get("/", (_req: Request, res: Response<ApiResponse<Startup[]>>) => {
  const all = Array.from(startups.values());
  res.json({ success: true, data: all });
});

// GET /api/startups/:id
router.get("/:id", (req: Request, res: Response<ApiResponse<Startup>>) => {
  const startup = startups.get(req.params.id);

  if (!startup) {
    res.status(404).json({ success: false, error: "Startup not found" });
    return;
  }

  res.json({ success: true, data: startup });
});

// POST /api/startups
router.post("/", (req: Request, res: Response<ApiResponse<Startup>>) => {
  const { name, description, industry, founded } = req.body as CreateStartupInput;

  if (!name || !description || !industry || !founded) {
    res.status(400).json({
      success: false,
      error: "Missing required fields: name, description, industry, founded",
    });
    return;
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const startup: Startup = { id, name, description, industry, founded, createdAt: now, updatedAt: now };

  startups.set(id, startup);
  res.status(201).json({ success: true, data: startup });
});

// PUT /api/startups/:id
router.put("/:id", (req: Request, res: Response<ApiResponse<Startup>>) => {
  const startup = startups.get(req.params.id);

  if (!startup) {
    res.status(404).json({ success: false, error: "Startup not found" });
    return;
  }

  const updates = req.body as UpdateStartupInput;
  const updated: Startup = {
    ...startup,
    ...updates,
    id: startup.id,
    createdAt: startup.createdAt,
    updatedAt: new Date().toISOString(),
  };

  startups.set(startup.id, updated);
  res.json({ success: true, data: updated });
});

// DELETE /api/startups/:id
router.delete("/:id", (req: Request, res: Response<ApiResponse>) => {
  const existed = startups.delete(req.params.id);

  if (!existed) {
    res.status(404).json({ success: false, error: "Startup not found" });
    return;
  }

  res.json({ success: true, data: { deleted: true } });
});

export default router;
