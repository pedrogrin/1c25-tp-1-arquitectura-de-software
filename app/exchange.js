import { nanoid } from "nanoid";

import {
  preloadRatesIfEmpty,
  preloadAccountsIfEmpty,
  getAccount,
  setAccount,
  getAllAccounts,
  setBuyRate,
  getBuyRate,
  getSellRate,
  getAllBuyRates,
  pushLog,
  getRecentLogs
} from "./redis.js";

import { StatsD } from 'hot-shots';
const statsd = new StatsD({
  host: 'graphite',
  port: 8125,
  prefix: 'exchange.',
  protocol: 'udp',
  errorHandler: (error) => console.error("StatsD error:", error)
});

//call to initialize the exchange service
export async function init() {
  await preloadRatesIfEmpty();
  await preloadAccountsIfEmpty();
}

//returns all internal accounts
export async function getAccounts() {
  return await getAllAccounts();
}

//sets balance for an account
export async function setAccountBalance(accountId, balance) {
  const account = await getAccount(accountId);
  if (account != null) {
    account.balance = balance;
    await setAccount(accountId, account);
  }
}

//returns all current exchange rates
export async function getRates() {
  const rates = await getAllBuyRates();
  const structured = { ARS: {} };
  for (const [curr, rate] of Object.entries(rates)) {
    structured[curr] = { ARS: rate };
    structured.ARS[curr] = 1 / rate;
  }
  return structured;
}

//returns transaction log
export async function getLog(limit = 50) {
  return await getRecentLogs(limit);
}

//sets the exchange rate for a given pair of currencies, and the reciprocal rate as well
export async function setRate(rateRequest) {
  const { baseCurrency, counterCurrency, rate } = rateRequest;


  if (counterCurrency === "ARS") {
    await setBuyRate(baseCurrency, rate);
  } else if (baseCurrency === "ARS") {
    await setBuyRate(counterCurrency, 1 / rate);
  } else {
    throw new Error("Only rates involving ARS are supported.");
  }
}

//executes an exchange operation
export async function exchange(exchangeRequest) {
  const {
    baseCurrency,
    counterCurrency,
    baseAccountId: clientBaseAccountId,
    counterAccountId: clientCounterAccountId,
    baseAmount,
  } = exchangeRequest;

  // get the exchange rate
  let exchangeRate = null;
  if (counterCurrency === "ARS") {
    exchangeRate = await getBuyRate(baseCurrency);
  } else if (baseCurrency === "ARS") {
    exchangeRate = await getSellRate(counterCurrency);
  }

  if (!exchangeRate) {
    throw new Error(`No exchange rate available for ${baseCurrency}→${counterCurrency}`);
  }

  //compute the requested (counter) amount
  const counterAmount = baseAmount * exchangeRate;

  //find our accounts
  const allAccounts = Object.values(await getAllAccounts());
  const baseAccount = allAccounts.find((a) => a.currency === baseCurrency);
  const counterAccount = allAccounts.find((a) => a.currency === counterCurrency);

  //construct the result object with defaults
  const exchangeResult = {
    id: nanoid(),
    ts: new Date(),
    ok: false,
    request: exchangeRequest,
    exchangeRate,
    counterAmount: 0.0,
    obs: null,
  };

  //check if we have funds on the counter currency account
  if (counterAccount.balance >= counterAmount) {
    //try to transfer from clients' base account
    if (await transfer(clientBaseAccountId, baseAccount.id, baseAmount)) {
      //try to transfer to clients' counter account
      if (await transfer(counterAccount.id, clientCounterAccountId, counterAmount)) {
        //all good, update balances
        baseAccount.balance += baseAmount;
        counterAccount.balance -= counterAmount;
        await setAccount(baseAccount.id, baseAccount);
        await setAccount(counterAccount.id, counterAccount);

        exchangeResult.ok = true;
        exchangeResult.counterAmount = counterAmount;

        statsd.increment(`volume.${counterCurrency}`, counterAmount);
        statsd.increment(`volume.${baseCurrency}`, baseAmount);
        statsd.increment(`net.${counterCurrency}`, counterAmount);
        statsd.decrement(`net.${baseCurrency}`, baseAmount);
      } else {
        //could not transfer to clients' counter account, return base amount to client
        await transfer(baseAccount.id, clientBaseAccountId, baseAmount);
        exchangeResult.obs = "Could not transfer to clients' counter account";
      }
    } else {
      //could not withdraw from clients' account
      exchangeResult.obs = "Could not withdraw from clients' base account";
    }
  } else {
    //not enough funds on internal counter account
    exchangeResult.obs = "Not enough funds on counter currency account";
  }

  //log the transaction and return it
  await pushLog(exchangeResult);
  return exchangeResult;
}

//internal - call transfer service to execute transfer between accounts
async function transfer(fromAccountId, toAccountId, amount) {
  const min = 200;
  const max = 400;
  return new Promise((resolve) =>
    setTimeout(() => resolve(true), Math.random() * (max - min + 1) + min)
  );
}
