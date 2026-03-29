const Tesseract = require('tesseract.js');
const path = require('path');

const CATEGORY_KEYWORDS = {
  'Meals': ['restaurant', 'cafe', 'coffee', 'food', 'dining', 'lunch', 'dinner', 'breakfast', 'pizza', 'burger', 'bar', 'grill', 'kitchen', 'bistro', 'bakery', 'deli', 'sushi', 'starbucks', 'mcdonald', 'subway', 'domino', 'kfc', 'swiggy', 'zomato', 'dine', 'eat', 'beverage', 'tea', 'snack', 'meal', 'biryani', 'paneer', 'chicken', 'noodle', 'rice', 'curry'],
  'Travel': ['airline', 'flight', 'airport', 'taxi', 'uber', 'lyft', 'ola', 'cab', 'train', 'railway', 'booking', 'travel', 'airways', 'jet', 'indigo', 'spicejet', 'irctc', 'makemytrip', 'goibibo', 'cleartrip'],
  'Accommodation': ['hotel', 'inn', 'resort', 'motel', 'lodge', 'airbnb', 'oyo', 'marriott', 'hilton', 'hyatt', 'stay', 'hostel', 'room', 'check-in', 'checkout'],
  'Transportation': ['fuel', 'gas', 'petrol', 'diesel', 'parking', 'toll', 'metro', 'bus', 'transit', 'shell', 'hp', 'indian oil', 'bharat petroleum', 'iocl', 'bpcl', 'hpcl', 'rapido'],
  'Office Supplies': ['staples', 'office', 'paper', 'pen', 'printer', 'ink', 'stationery', 'supplies', 'amazon', 'flipkart'],
  'Software': ['software', 'subscription', 'license', 'saas', 'cloud', 'microsoft', 'google', 'adobe', 'aws', 'digital', 'hosting', 'domain'],
  'Hardware': ['electronics', 'computer', 'laptop', 'phone', 'monitor', 'keyboard', 'mouse', 'cable', 'charger', 'adapter', 'croma', 'reliance digital'],
  'Training': ['training', 'course', 'workshop', 'seminar', 'conference', 'education', 'udemy', 'coursera', 'certification'],
  'Client Entertainment': ['entertainment', 'event', 'ticket', 'cinema', 'movie', 'show', 'concert', 'theatre'],
};

const scanReceipt = async (filePath) => {
  const absolutePath = path.resolve(filePath);

  console.log('Starting OCR scan on:', absolutePath);

  const { data } = await Tesseract.recognize(absolutePath, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        process.stdout.write(`\rOCR: ${(m.progress * 100).toFixed(0)}%`);
      }
    },
  });

  console.log('\nOCR complete. Confidence:', data.confidence);

  const text = data.text;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  console.log('--- RAW OCR TEXT ---');
  console.log(text);
  console.log('--- END ---');

  const amount = extractAmount(text, lines);
  const currency = extractCurrency(text);
  const date = extractDate(text);
  const merchant = extractMerchant(lines);
  const category = extractCategory(text);
  const description = buildDescription(lines, merchant);
  const expenseLines = extractExpenseLines(lines);

  const result = {
    rawText: text,
    merchant,
    title: merchant || (category !== 'Other' ? `${category} expense` : null),
    amount,
    currency,
    date,
    description,
    category,
    expenseLines,
    confidence: data.confidence,
  };

  console.log('Extracted:', JSON.stringify({ ...result, rawText: '...' }, null, 2));
  return result;
};

function extractAmount(text, lines) {
  // Strategy 1: Look for "Total" lines (most reliable)
  const totalPatterns = [
    /(?:grand\s*total|total\s*amount|net\s*total|total\s*payable|amount\s*payable|amount\s*due|bill\s*amount|invoice\s*total|total\s*bill)\s*[:\-=]?\s*[^\d]*([\d,]+\.?\d*)/i,
    /(?:total)\s*[:\-=]?\s*[^\d]*([\d,]+\.\d{2})/i,
    /(?:total)\s*[:\-=]?\s*[^\d]*([\d,]+)/i,
  ];

  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      if (val > 0 && val < 10000000) return val;
    }
  }

  // Strategy 2: Find lines containing "total" and extract the number from them
  for (const line of lines) {
    if (/total/i.test(line) && !/sub\s*total|items?\s*total/i.test(line)) {
      const nums = line.match(/[\d,]+\.?\d*/g);
      if (nums) {
        // Take the last number on the total line (usually the amount)
        const val = parseFloat(nums[nums.length - 1].replace(/,/g, ''));
        if (val > 0 && val < 10000000) return val;
      }
    }
  }

  // Strategy 3: Find all currency-prefixed amounts and take the largest
  const amounts = [];

  // Match: $123.45, Rs.123, Rs 123, ₹123, €123, £123
  const currencyAmountRegex = /(?:[\$\u20B9\u00A3\u20AC\u00A5]|Rs\.?\s*|INR\s*|USD\s*|EUR\s*|GBP\s*)\s*([\d,]+\.?\d*)/gi;
  let m;
  while ((m = currencyAmountRegex.exec(text)) !== null) {
    const val = parseFloat(m[1].replace(/,/g, ''));
    if (val > 0 && val < 10000000) amounts.push(val);
  }

  // Match standalone decimal amounts: 123.45
  const decimalRegex = /\b(\d{1,3}(?:,\d{3})*\.\d{2})\b/g;
  while ((m = decimalRegex.exec(text)) !== null) {
    const val = parseFloat(m[1].replace(/,/g, ''));
    if (val > 0 && val < 10000000) amounts.push(val);
  }

  if (amounts.length > 0) {
    return Math.max(...amounts);
  }

  // Strategy 4: Just find the largest number in the text
  const allNums = text.match(/\d[\d,]*\.?\d*/g) || [];
  const parsed = allNums.map(n => parseFloat(n.replace(/,/g, ''))).filter(n => n > 1 && n < 10000000);
  if (parsed.length > 0) {
    return Math.max(...parsed);
  }

  return null;
}

function extractCurrency(text) {
  // Check in order of specificity
  if (/\u20B9|Rs\.?[\s\d]|INR[\s\d]|rupee/i.test(text)) return 'INR';
  if (/\u00A3|GBP/i.test(text)) return 'GBP';
  if (/\u20AC|EUR/i.test(text)) return 'EUR';
  if (/\u00A5|JPY|YEN/i.test(text)) return 'JPY';
  if (/\$|USD/i.test(text)) return 'USD';
  if (/C\$/i.test(text)) return 'CAD';
  if (/A\$/i.test(text)) return 'AUD';
  return null;
}

function extractDate(text) {
  const patterns = [
    // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    { regex: /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/, parse: (m) => tryDate(m[1], m[2], m[3]) },
    // YYYY-MM-DD
    { regex: /\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/, parse: (m) => tryDate(m[3], m[2], m[1]) },
    // DD/MM/YY
    { regex: /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})\b/, parse: (m) => tryDate(m[1], m[2], '20' + m[3]) },
    // Month DD, YYYY
    { regex: /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i, parse: (m) => tryMonthDate(m[1], m[2], m[3]) },
    // DD Month YYYY
    { regex: /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{4})/i, parse: (m) => tryMonthDate(m[2], m[1], m[3]) },
    // DD-Mon-YYYY (e.g., 29-Mar-2026)
    { regex: /\b(\d{1,2})[\-\s](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\-\s](\d{4})/i, parse: (m) => tryMonthDate(m[2], m[1], m[3]) },
  ];

  for (const { regex, parse } of patterns) {
    const match = text.match(regex);
    if (match) {
      const d = parse(match);
      if (d) return d;
    }
  }
  return null;
}

function tryDate(day, month, year) {
  const d = parseInt(day), mo = parseInt(month), y = parseInt(year);
  if (y < 2000 || y > 2100) return null;
  // If day > 12, it's definitely DD/MM format. Otherwise try both.
  let date;
  if (d > 12) {
    date = new Date(y, mo - 1, d);
  } else if (mo > 12) {
    date = new Date(y, d - 1, mo); // swapped
  } else {
    date = new Date(y, mo - 1, d); // assume DD/MM
  }
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

function tryMonthDate(monthStr, day, year) {
  const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const mo = months[monthStr.toLowerCase().substring(0, 3)];
  if (mo === undefined) return null;
  const d = new Date(parseInt(year), mo, parseInt(day));
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

function extractMerchant(lines) {
  // Skip noise lines and look for the merchant name (usually first meaningful line)
  const skipPatterns = /^(tel|ph|fax|email|www|http|gst|gstin|cin|pan|tax|invoice|receipt|bill|date|time|order|table|cashier|server|#|\d{5,}|page)/i;

  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const line = lines[i].replace(/[^a-zA-Z0-9\s&'.\-,]/g, '').trim();
    if (line.length < 2 || line.length > 60) continue;
    if (/^\d[\d\s/.\-:]+$/.test(line)) continue; // Pure numbers/dates
    if (skipPatterns.test(line)) continue;
    if (/^[A-Z\s&'.]{2,}$/i.test(line)) return line; // Likely a name
    if (line.split(' ').length <= 5) return line;
  }
  return null;
}

function extractCategory(text) {
  const lower = text.toLowerCase();
  let best = 'Other';
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score += (kw.length > 5 ? 2 : 1); // Longer keywords = higher weight
    }
    if (score > bestScore) {
      bestScore = score;
      best = category;
    }
  }
  return best;
}

function buildDescription(lines, merchant) {
  const meaningful = lines.filter((line) => {
    if (line.length < 4 || line.length > 80) return false;
    if (/^(tel|ph|fax|email|www|http|gst|gstin|cin|pan|thank|visit|welcome|have a|powered|pay|card|cash|change|upi|ref)/i.test(line)) return false;
    if (/^\d+$/.test(line)) return false;
    if (/^\*+$/.test(line) || /^[-=]+$/.test(line)) return false;
    return true;
  });

  // Take up to 3 lines, skip the merchant line if we already have it
  const desc = meaningful
    .filter(l => l !== merchant)
    .slice(0, 3)
    .join(', ');

  return desc || null;
}

function extractExpenseLines(lines) {
  const items = [];
  // Match lines with text followed by a price at the end
  const patterns = [
    /^(.{3,35}?)\s{2,}([\d,]+\.?\d*)\s*$/,     // "Item name    123.45"
    /^(.{3,35}?)\s+([\d,]+\.\d{2})\s*$/,         // "Item name 123.45"
    /^(\d+)\s+(.{3,30}?)\s+([\d,]+\.?\d*)\s*$/,  // "1 Item name 123.45"
  ];

  for (const line of lines) {
    if (/total|tax|sub|gst|vat|discount|cgst|sgst|cess|round|change|cash|card|upi/i.test(line)) continue;

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const groups = match.length === 4 ? [match[2], match[3]] : [match[1], match[2]];
        const name = groups[0].trim();
        const amount = parseFloat(groups[1].replace(/,/g, ''));
        if (amount > 0 && amount < 1000000 && name.length > 1) {
          items.push({ item: name, amount });
          break;
        }
      }
    }
  }

  return items;
}

module.exports = { scanReceipt };
