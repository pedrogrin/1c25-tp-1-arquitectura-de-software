import express from "express";

import {
  init as exchangeInit,
  getAccounts,
  setAccountBalance,
  getRates,
  setRate,
  getLog,
  exchange,
} from "./exchange.js";

await exchangeInit();

const app = express();
const port = 3000;

app.use(express.json());

// ACCOUNT endpoints

app.get("/accounts", async (req, res) => {
  res.json(await getAccounts());
});

app.put("/accounts/:id/balance", async (req, res) => {
  const accountId = req.params.id;
  const { balance } = req.body;

  if (!accountId || balance == null) {
    return res.status(400).json({ error: "Malformed request" });
  }

  await setAccountBalance(accountId, balance);
  res.json(await getAccounts());
});

// RATE endpoints

app.get("/rates", async (req, res) => {
  res.json(await getRates());
});

app.put("/rates", async (req, res) => {
  const { baseCurrency, counterCurrency, rate } = req.body;

  if (!baseCurrency || !counterCurrency || rate == null) {
    return res.status(400).json({ error: "Malformed request" });
  }

  await setRate({ baseCurrency, counterCurrency, rate });
  res.json(await getRates());
});

// LOG endpoint

app.get("/log", async (req, res) => {

  if (req.query.limit) {
    const limit = parseInt(req.query.limit, 10);
    
    if (isNaN(limit)) {
      return res.status(400).json({ error: "Invalid limit parameter" });
    }

    return res.json(await getLog(limit));

  }

  res.json(await getLog());
});

// EXCHANGE endpoint

app.post("/exchange", async (req, res) => {
  const {
    baseCurrency,
    counterCurrency,
    baseAccountId,
    counterAccountId,
    baseAmount,
  } = req.body;

  if (
    !baseCurrency ||
    !counterCurrency ||
    !baseAccountId ||
    !counterAccountId ||
    !baseAmount
  ) {
    return res.status(400).json({ error: "Malformed request" });
  }

  const exchangeRequest = { ...req.body };
  const exchangeResult = await exchange(exchangeRequest);

  if (exchangeResult.ok) {
    res.status(200).json(exchangeResult);
  } else {
    res.status(500).json(exchangeResult);
  }
});

app.listen(port, () => {
  console.log(`Exchange API listening on port ${port}`);
});

export default app;
