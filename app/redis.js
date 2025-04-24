import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
});

const ACCOUNTS_KEY = 'accounts';
const RATE_KEY = 'rates';
const LOG_KEY = 'log';

// --- ACCOUNTS ---

export async function getAccount(id) {
    const raw = await redis.hget(ACCOUNTS_KEY, id);
    return raw ? JSON.parse(raw) : null;
  }
  
  export async function setAccount(id, data) {
    await redis.hset(ACCOUNTS_KEY, id, JSON.stringify(data));
  }
  
  export async function getAllAccounts() {
    const result = await redis.hgetall(ACCOUNTS_KEY);
    return Object.fromEntries(
      Object.entries(result).map(([id, json]) => [id, JSON.parse(json)])
    );
  }
  
  
  // --- LOGS ---
  
  export async function pushLog(entry) {
    await redis.lpush(LOG_KEY, JSON.stringify(entry));
  }
  
  export async function getRecentLogs(limit = 50) {
    const logs = await redis.lrange(LOG_KEY, 0, limit - 1);
    return logs.map((entry) => JSON.parse(entry));
  }
  
  // --- RATES ---

  // COMPRAR ARS
  export async function getBuyRate(currency) {
    const rate = await redis.hget(RATE_KEY, currency);
    return rate ? parseFloat(rate) : null;
  }
  
  // VENDER ARS
  export async function getSellRate(currency) {
    const buyRate = await getBuyRate(currency);
    return buyRate ? 1 / buyRate : null;
  }
  
  // TASA PARA COMPRAR ARS
  export async function setBuyRate(currency, rate) {
    await redis.hset(RATE_KEY, currency, rate);
  }
  
  export async function getAllBuyRates() {
    const raw = await redis.hgetall(RATE_KEY);
    return Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, parseFloat(v)])
    );
  }
  
  // --- INIT ---
  
  import { fileURLToPath } from "url";
  import path from "path";
  import fs from "fs/promises";
  
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  export async function preloadRatesIfEmpty() {
    const existing = await redis.hlen(RATE_KEY);
    if (existing > 0) return;
  
    const filePath = path.join(__dirname, "./state/rates.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const rates = JSON.parse(raw);
  
    for (const [from, targets] of Object.entries(rates)) {
      for (const [to, rate] of Object.entries(targets)) {
        if (to === "ARS") {
          // Solo guardamos tasas para comprar ARS
          await setBuyRate(from, rate);
        }
      }
    }
  
  }

  export async function preloadAccountsIfEmpty() {
    const existing = await redis.keys(ACCOUNTS_KEY);
    if (existing > 0) return;
  
    const filePath = path.join(__dirname, "./state/accounts.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const defaultAccounts = JSON.parse(raw);
  
    for (const account of defaultAccounts) {
        await redis.hset(ACCOUNTS_KEY, account.id, JSON.stringify(account));
      }
  
  }