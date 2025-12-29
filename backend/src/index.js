import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import apiRoutes from "./routes/api.js";
import { checkDynamoDBConnection } from "./dynamodb.js";
import redis from "./redis.js";

dotenv.config();

const app = express();
const PORT = process.env.EXPRESS_PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api", apiRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "EcoScoot Backend",
  });
});

// Sprawdź połączenia z bazami danych
async function checkConnections() {
  console.log("\n🔍 Sprawdzanie połączeń...\n");

  // Sprawdź DynamoDB
  await checkDynamoDBConnection();

  // Redis jest już połączony w redis.js

  console.log("");
}

// Start server
app.listen(PORT, async () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║   🛴 EcoScoot Backend Started! 🛴      ║
  ║   🌐 http://localhost:${PORT}             ║
  ╚════════════════════════════════════════╝
  `);

  await checkConnections();

  console.log(`
  📝 Aby zainicjalizować tabele DynamoDB:
     POST http://localhost:${PORT}/api/init

  📝 Aby wygenerować przykładowe dane:
     POST http://localhost:${PORT}/api/seed

  📝 Dostępne endpointy:
     - POST /api/auth/register     - Rejestracja
     - POST /api/auth/login        - Logowanie
     - GET  /api/scooters          - Lista hulajnóg
     - POST /api/reservations      - Utwórz rezerwację
     - GET  /api/users/me          - Twój profil
  `);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  redis.quit();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("\n👋 Zamykanie serwera...");
  redis.quit();
  process.exit(0);
});
