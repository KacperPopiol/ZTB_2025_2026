import express from "express";
import { systemState } from "../utils/systemState.js";

const router = express.Router();

// GET /api/system/status
router.get("/status", (req, res) => {
  res.json({
    redisEnabled: systemState.redisEnabled,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// POST /api/system/redis
router.post("/redis", (req, res) => {
  const { enabled } = req.body;

  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: "Wymagana wartość boolean dla pola 'enabled'" });
  }

  systemState.redisEnabled = enabled;
  
  console.log(`[SYSTEM] Zmieniono status Redis na: ${enabled ? 'WŁĄCZONY' : 'WYŁĄCZONY'}`);

  res.json({
    success: true,
    redisEnabled: systemState.redisEnabled,
    message: `Redis został ${enabled ? 'włączony' : 'wyłączony'}`
  });
});

export default router;