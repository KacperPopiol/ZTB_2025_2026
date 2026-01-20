import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import docClient, { TABLES } from "../dynamodb.js";
import redis from "../redis.js";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

// Współrzędne: Nowy Sącz
const CITY_CENTER = { lat: 49.6215, lon: 20.6969 };
const CITY_RADIUS_KM = 5;

function generateRandomCoordinates() {
  const latOffset = (Math.random() - 0.5) * (CITY_RADIUS_KM / 111);
  const lonOffset = (Math.random() - 0.5) * (CITY_RADIUS_KM / 111);

  return {
    lat: CITY_CENTER.lat + latOffset,
    lon: CITY_CENTER.lon + lonOffset,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Seedowanie użytkowników
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function seedUsers() {
  console.log("👥 Tworzenie użytkowników...");

  const hashedPassword = await bcrypt.hash("password123", 10);
  const now = new Date().toISOString();

  // Administrator
  const admin = {
    userId: uuidv4(),
    email: "admin@ecoscoot.pl",
    password: hashedPassword,
    firstName: "Admin",
    lastName: "System",
    role: "admin",
    createdAt: now,
    updatedAt: now,
    isActive: true,
  };

  const adminCommand = new PutCommand({
    TableName: TABLES.USERS,
    Item: admin,
  });

  await docClient.send(adminCommand);
  console.log("Administrator utworzony: admin@ecoscoot.pl / password123");

  // Przykładowi użytkownicy
  const users = [
    {
      userId: uuidv4(),
      email: "jan.kowalski@example.com",
      password: hashedPassword,
      firstName: "Jan",
      lastName: "Kowalski",
      role: "user",
      createdAt: now,
      updatedAt: now,
      isActive: true,
    },
    {
      userId: uuidv4(),
      email: "anna.nowak@example.com",
      password: hashedPassword,
      firstName: "Anna",
      lastName: "Nowak",
      role: "user",
      createdAt: now,
      updatedAt: now,
      isActive: true,
    },
    {
      userId: uuidv4(),
      email: "piotr.wisniewski@example.com",
      password: hashedPassword,
      firstName: "Piotr",
      lastName: "Wiśniewski",
      role: "user",
      createdAt: now,
      updatedAt: now,
      isActive: true,
    },
  ];

  for (const user of users) {
    const command = new PutCommand({
      TableName: TABLES.USERS,
      Item: user,
    });
    await docClient.send(command);
  }

  console.log(
    `${users.length} użytkowników utworzonych (hasło dla wszystkich: password123)`,
  );

  return { admin, users };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Generowanie skrótu modelu dla identyfikatora
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function generateModelPrefix(model) {
  if (!model) return 'SC';
  
  const words = model.toUpperCase().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 4).replace(/[^A-Z0-9]/g, '');
  } else {
    return words.map(w => w[0]).join('').substring(0, 4).replace(/[^A-Z0-9]/g, '');
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Seedowanie hulajnóg
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function seedScootersData() {
  console.log("Tworzenie hulajnóg...");

  await redis.del("scooters:locations");

  const models = [
    "Xiaomi Mi 3",
    "Ninebot Max G30",
    "Segway E45",
    "Dualtron Thunder",
  ];
  const statuses = [
    "available",
    "available",
    "available",
    "available",
    "maintenance",
  ];
  const scooters = [];
  
  const modelCounters = {};

  for (let i = 1; i <= 80000; i++) {
    const scooterId = uuidv4();
    const { lat, lon } = generateRandomCoordinates();
    const battery = Math.floor(Math.random() * 100) + 1; // 1-100%
    const model = models[Math.floor(Math.random() * models.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const now = new Date().toISOString();
    
    const prefix = generateModelPrefix(model);
    if (!modelCounters[model]) {
      modelCounters[model] = 0;
    }
    modelCounters[model]++;
    const identifier = `${prefix}-${String(modelCounters[model]).padStart(3, '0')}`;

    const scooter = {
      scooterId,
      identifier,
      model,
      latitude: lat,
      longitude: lon,
      battery,
      status,
      createdAt: now,
      updatedAt: now,
      totalRides: Math.floor(Math.random() * 100),
      totalDistance: Math.floor(Math.random() * 1000),
    };

    const command = new PutCommand({
      TableName: TABLES.SCOOTERS,
      Item: scooter,
    });

    await docClient.send(command);

    await redis.geoadd("scooters:locations", lon, lat, scooterId);

    scooters.push(scooter);
  }

  console.log(`${scooters.length} hulajnóg utworzonych`);
  return scooters;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Główna funkcja seedowania
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function seedScooters() {
  try {
    console.log("\nRozpoczynam seedowanie danych...\n");

    const keys = await redis.keys("scooter:*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    await redis.del("scooters:all:*");
    await redis.del("scooters:stats");

    await seedUsers();

    console.log("");

    await seedScootersData();

    console.log("\nSeedowanie zakończone pomyślnie!\n");
    console.log("   Dane logowania:");
    console.log("   Admin: admin@ecoscoot.pl / password123");
    console.log("   User1: jan.kowalski@example.com / password123");
    console.log("   User2: anna.nowak@example.com / password123");
    console.log("   User3: piotr.wisniewski@example.com / password123\n");

    return true;
  } catch (error) {
    console.error("Błąd seedowania:", error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Funkcja pomocnicza do wyszukiwania hulajnóg w pobliżu
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getScootersNearby(lat, lon, distance = 500) {
  try {
    const result = await redis.geosearch(
      "scooters:locations",
      "FROMLONLAT",
      lon,
      lat,
      "BYRADIUS",
      distance,
      "m",
      "ASC",
    );

    return result;
  } catch (error) {
    console.error("Błąd wyszukiwania hulajnóg:", error);
    return [];
  }
}
