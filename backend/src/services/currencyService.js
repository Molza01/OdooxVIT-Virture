const COUNTRY_API = 'https://restcountries.com/v3.1/all?fields=name,currencies,cca2,flag';
const EXCHANGE_API = 'https://api.exchangerate-api.com/v4/latest';

// Cache to avoid hammering external APIs
let countriesCache = null;
let countriesCacheTime = 0;
const exchangeRateCache = {};
const CACHE_TTL = 3600000; // 1 hour

const getCountries = async () => {
  if (countriesCache && Date.now() - countriesCacheTime < CACHE_TTL) {
    return countriesCache;
  }

  const response = await fetch(COUNTRY_API);
  if (!response.ok) throw new Error('Failed to fetch countries');

  const data = await response.json();

  const countries = data
    .map((c) => {
      const currencyEntries = Object.entries(c.currencies || {});
      if (currencyEntries.length === 0) return null;
      const [code, info] = currencyEntries[0];
      return {
        name: c.name.common,
        currencyCode: code,
        currencyName: info.name,
        currencySymbol: info.symbol || code,
        flag: c.flag || '',
        cca2: c.cca2 || '',
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));

  countriesCache = countries;
  countriesCacheTime = Date.now();
  return countries;
};

const getExchangeRate = async (baseCurrency, targetCurrency) => {
  if (baseCurrency === targetCurrency) {
    return { rate: 1, baseCurrency, targetCurrency };
  }

  const cacheKey = `${baseCurrency}_${targetCurrency}`;
  if (exchangeRateCache[cacheKey] && Date.now() - exchangeRateCache[cacheKey].time < CACHE_TTL) {
    return exchangeRateCache[cacheKey].data;
  }

  const response = await fetch(`${EXCHANGE_API}/${baseCurrency}`);
  if (!response.ok) throw new Error(`Failed to fetch exchange rate for ${baseCurrency}`);

  const data = await response.json();
  const rate = data.rates[targetCurrency];

  if (!rate) {
    throw new Error(`Exchange rate not found for ${baseCurrency} to ${targetCurrency}`);
  }

  const result = { rate, baseCurrency, targetCurrency };
  exchangeRateCache[cacheKey] = { data: result, time: Date.now() };
  return result;
};

const convertCurrency = async (amount, fromCurrency, toCurrency) => {
  if (fromCurrency === toCurrency) {
    return { convertedAmount: amount, exchangeRate: 1 };
  }

  const { rate } = await getExchangeRate(fromCurrency, toCurrency);
  const convertedAmount = parseFloat((amount * rate).toFixed(2));
  return { convertedAmount, exchangeRate: rate };
};

module.exports = { getCountries, getExchangeRate, convertCurrency };
