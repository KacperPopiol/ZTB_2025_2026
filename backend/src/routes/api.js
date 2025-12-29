import express from "express";
import authRoutes from "./auth.js";
import userRoutes from "./users.js";
import scooterRoutes from "./scooters.js";
import reservationRoutes from "./reservations.js";
import pricingRoutes from "./pricing.js";
import rideRoutes from "./rides.js";
import { initializeDynamoDB } from "../utils/initDynamoDB.js";
import { seedScooters } from "../utils/seedData.js";

const router = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API Routes
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Autentykacja
router.use("/auth", authRoutes);

// Użytkownicy
router.use("/users", userRoutes);

// Hulajnogi
router.use("/scooters", scooterRoutes);

// Rezerwacje
router.use("/reservations", reservationRoutes);

// Ceny
router.use("/pricing", pricingRoutes);

// Jazdy
router.use("/rides", rideRoutes);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Utility Routes
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// POST /api/init - Inicjalizacja tabel DynamoDB
router.post("/init", async (req, res) => {
  try {
    const reset = req.query.reset === "true";
    const success = await initializeDynamoDB(reset);

    if (success) {
      res.json({
        success: true,
        message: "Tabele DynamoDB zainicjalizowane",
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Błąd inicjalizacji DynamoDB",
      });
    }
  } catch (error) {
    console.error("Błąd inicjalizacji:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/seed - Wygeneruj przykładowe dane
router.post("/seed", async (req, res) => {
  try {
    await seedScooters();
    res.json({
      success: true,
      message: "Przykładowe dane wygenerowane",
    });
  } catch (error) {
    console.error("Błąd seedowania:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/health - Health check
router.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "EcoScoot API",
  });
});

export default router;
