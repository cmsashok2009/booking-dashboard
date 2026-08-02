import "dotenv/config";
import { ensureOnboardingData } from "../src/onboarding.js";
import { createPasswordHash, passwordErrors } from "../src/passwords.js";
import { MySqlStateStore } from "../src/state-store.js";
import { encodeStoredData } from "../src/storage-crypto.js";
import { seedData } from "../src/validators.js";

const email = String(process.env.INITIAL_ADMIN_EMAIL || "").trim().toLowerCase();
const name = String(process.env.INITIAL_ADMIN_NAME || "System Administrator").trim();
const password = String(process.env.INITIAL_ADMIN_PASSWORD || "");

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("INITIAL_ADMIN_EMAIL must be a valid email address");
const errors = passwordErrors(password);
if (errors.length) throw new Error(`INITIAL_ADMIN_PASSWORD is invalid: ${errors.join("; ")}`);

const seeded = seedData();
const now = new Date().toISOString();
seeded.users = [{
  id: "u-admin",
  name,
  email,
  phone: "",
  role: "Admin",
  region: "All",
  reportingManagerEmail: "",
  status: "active",
  passwordHash: createPasswordHash(password),
  mustChangePassword: true,
  createdAt: now
}];
seeded.bookings = [];
seeded.dealerAssignments = [];
seeded.fileUploads = [];
seeded.auditLogs = [];
seeded.notifications = [];
ensureOnboardingData(seeded);

const store = new MySqlStateStore(process.env);
try {
  let state;
  let lastError;
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      state = await store.initialize(encodeStoredData(seeded));
      break;
    } catch (error) {
      lastError = error;
      if (!["ECONNREFUSED", "PROTOCOL_CONNECTION_LOST", "ETIMEDOUT"].includes(error.code) || attempt === 30) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  if (!state) throw lastError;
  console.log(JSON.stringify({ initialized: true, driver: "mysql", version: state.version }));
} finally {
  await store.close();
}