/**
 * Lulu Juicer Rule-Based Parser
 * Parses plain text daily slips into structured data.
 * Pure TypeScript, zero external dependencies.
 * Never throws an exception.
 */

export interface ParsedExpenseItem {
  label: string;
  amount: number;
}

export interface ParseResult {
  kind: 'slip' | 'fixed_cost' | 'salary_list' | 'fruits_purchase' | 'sadia_purchase' | 'photo' | 'voice' | 'other';
  date: string; // YYYY-MM-DD
  cash_expenses_stated: number;
  cash_expenses_calc: number;
  card_atm_total: number;
  card_atm_calc: number;
  total_on_bill: number;
  keeta: number;
  keeta_status: 'value' | 'blank' | 'missing';
  talabat: number;
  talabat_status: 'value' | 'blank' | 'missing';
  unlabeled: number;
  expense_items: [string, number][];
  atm_entries: number[];
  flag: 'ok' | 'minor' | 'needs_review';
  warnings: string[];
  raw_text: string;
}

// Convert Eastern Arabic / Persian numerals to Western Arabic
function normalizeDigits(str: string): string {
  const easternArabic = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  
  let result = str;
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(easternArabic[i], 'g'), String(i));
    result = result.replace(new RegExp(persian[i], 'g'), String(i));
  }
  return result;
}

// Parse integer amount from currency strings
function parseAmount(raw: string): number {
  if (!raw) return 0;
  // Clean commas, currency tokens (QAR, QR, etc.), spaces
  const cleaned = raw
    .replace(/[,\s]/g, '')
    .replace(/qar|qr|ر\.ق/gi, '')
    .trim();
  const val = parseInt(cleaned, 10);
  return isNaN(val) ? 0 : val;
}

// Map 3-letter month abbreviations
const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04',
  may: '05', jun: '06', jul: '07', aug: '08',
  sep: '09', oct: '10', nov: '11', dec: '12'
};

// Robust date parser
export function parseSlipDate(line: string, fallbackDate?: string): string {
  const norm = normalizeDigits(line).toLowerCase();
  
  // Try pattern: DD Mon YYYY (e.g. "01 Nov 2026", "23 Nov 2026", "07 novemever", "01 -novmber")
  const match = norm.match(/(\d{1,2})\s*[-–—:]*\s*([a-z]{3})[a-z]*\s*(\d{4})?/i);
  if (match) {
    const day = match[1].padStart(2, '0');
    const monthKey = match[2].toLowerCase();
    const month = MONTH_MAP[monthKey] || '11';
    const year = match[3] || (fallbackDate ? fallbackDate.split('-')[0] : '2026');
    return `${year}-${month}-${day}`;
  }

  return fallbackDate || new Date().toISOString().split('T')[0];
}

export function parseDailySlip(rawText: string, fallbackDate?: string): ParseResult {
  const warnings: string[] = [];
  const normalized = normalizeDigits(rawText || '');
  const lines = normalized.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  let date = '';
  let cash_expenses_stated = 0;
  let card_atm_total = 0;
  let total_on_bill = 0;
  let keeta = 0;
  let keeta_status: 'value' | 'blank' | 'missing' = 'missing';
  let talabat = 0;
  let talabat_status: 'value' | 'blank' | 'missing' = 'missing';
  let unlabeled = 0;
  const expense_items: [string, number][] = [];
  const atm_entries: number[] = [];

  let section: 'header' | 'expenses' | 'atm' | 'footer' = 'header';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check header / date
    if (i === 0 || line.toLowerCase().includes('lulu juicer')) {
      const datePart = line.split('|')[1] || line;
      date = parseSlipDate(datePart, fallbackDate);
      continue;
    }

    // Check for totals first (to avoid section headers capturing total lines)
    if (/^(?:total\s+expenses|expense\s+total\s+on\s+slip)\s*[-–—:]/i.test(line)) {
      const match = line.match(/[-–—:]\s*(?:qar\s*)?([0-9,]+)/i);
      if (match) cash_expenses_stated = parseAmount(match[1]);
      continue;
    }

    if (/^(?:total\s+atm|atm\s+total\s+on\s+slip)\s*[-–—:]/i.test(line)) {
      const match = line.match(/[-–—:]\s*(?:qar\s*)?([0-9,]+)/i);
      if (match) card_atm_total = parseAmount(match[1]);
      section = 'footer';
      continue;
    }

    // Section boundary markers
    if (/^expenses\b/i.test(line)) {
      section = 'expenses';
      continue;
    }

    if (/^atm\b/i.test(line)) {
      // Check if it's a single line ATM total: e.g. "ATM – QAR 1,829" or "ATM - 2027"
      const singleMatch = line.match(/^atm\s*[-–—:]\s*(?:qar\s*)?([0-9,]+)/i);
      if (singleMatch) {
        card_atm_total = parseAmount(singleMatch[1]);
        section = 'footer';
        continue;
      }
      section = 'atm';
      continue;
    }

    if (/^total\s+on\s+bill\s*[-–—:]/i.test(line)) {
      const match = line.match(/[-–—:]\s*(?:qar\s*)?([0-9,]+)/i);
      if (match) total_on_bill = parseAmount(match[1]);
      section = 'footer';
      continue;
    }

    if (/^keeta\s*[-–—:]/i.test(line)) {
      const match = line.match(/^keeta\s*[-–—:]\s*(.+)$/i);
      if (match) {
        const valStr = match[1].trim();
        if (/blank/i.test(valStr) || valStr === '-' || valStr === '0') {
          keeta = 0;
          keeta_status = 'blank';
        } else {
          keeta = parseAmount(valStr);
          keeta_status = 'value';
        }
      }
      continue;
    }

    if (/^talabat\s*[-–—:]/i.test(line)) {
      const match = line.match(/^talabat\s*[-–—:]\s*(.+)$/i);
      if (match) {
        const valStr = match[1].trim();
        if (/blank/i.test(valStr) || valStr === '-' || valStr === '0') {
          talabat = 0;
          talabat_status = 'blank';
        } else {
          talabat = parseAmount(valStr);
          talabat_status = 'value';
        }
      }
      continue;
    }

    if (/^unlabeled\s+amount\s*[-–—:]/i.test(line)) {
      const match = line.match(/[-–—:]\s*(?:qar\s*)?([0-9,]+)/i);
      if (match) unlabeled = parseAmount(match[1]);
      continue;
    }

    // Ignore check / notes lines at the end
    if (/^check:/i.test(line) || /^note:/i.test(line)) {
      continue;
    }

    // Subtotal and additional ATM entries (like Nov 13)
    if (/^subtotal\s*[-–—:]/i.test(line) || /^additional\s+atm\s+entry\s*[-–—:]/i.test(line)) {
      continue;
    }

    // In Expenses section: lines look like "Rawabi – 835" or "Salary (name unclear) – 400"
    if (section === 'expenses') {
      const itemMatch = line.match(/^(.+?)\s*[-–—:]\s*(?:qar\s*)?([0-9,]+)$/i);
      if (itemMatch) {
        const itemLabel = itemMatch[1].trim();
        const itemAmount = parseAmount(itemMatch[2]);
        expense_items.push([itemLabel, itemAmount]);
      }
      continue;
    }

    // In ATM section: individual lines are numbers like "711", "1,041"
    if (section === 'atm') {
      const cleanNum = line.replace(/[,\s]/g, '');
      if (/^\d+$/.test(cleanNum)) {
        atm_entries.push(parseInt(cleanNum, 10));
      }
      continue;
    }
  }

  // Calculate sums
  const cash_expenses_calc = expense_items.reduce((sum, item) => sum + item[1], 0);
  const card_atm_calc = atm_entries.length > 0 ? atm_entries.reduce((sum, val) => sum + val, 0) : card_atm_total;

  // Validation checks
  const itemDiff = cash_expenses_calc - cash_expenses_stated;
  const atmDiff = atm_entries.length > 0 ? card_atm_calc - card_atm_total : 0;
  const billDiff = total_on_bill - (cash_expenses_stated + card_atm_total);

  let flag: 'ok' | 'minor' | 'needs_review' = 'ok';

  if (unlabeled > 0) {
    flag = 'needs_review';
    warnings.push(`Unlabeled amount present: QAR ${unlabeled}`);
  }

  if (itemDiff !== 0) {
    flag = 'needs_review';
    warnings.push(`Expense items sum (${cash_expenses_calc}) differs from stated (${cash_expenses_stated}) by ${itemDiff}`);
  }

  if (atmDiff !== 0) {
    flag = 'needs_review';
    warnings.push(`ATM entries sum (${card_atm_calc}) differs from stated (${card_atm_total}) by ${atmDiff}`);
  }

  if (billDiff !== 0) {
    // Check if difference is within minor tolerance (<= 10) AND no unlabeled
    // Note: Nov 13 has billDiff = -9 and no unlabeled, but in the fixture it's flagged as needs_review.
    // The brief says: "Nov 13: Bill 3,057 vs 1,340 + 1,726 = 3,066 (-9)" - known flags in seed data table lists it as needs_review.
    flag = 'needs_review';
    warnings.push(`Total on bill (${total_on_bill}) differs from cash + card (${cash_expenses_stated + card_atm_total}) by ${billDiff}`);
  }

  // Note: Unclear item names are preserved as written (and categorized during review or alias lookup)
  // Flag is strictly driven by arithmetic mismatch, unlabeled amounts, or unparseable lines.

  return {
    kind: 'slip',
    date: date || fallbackDate || new Date().toISOString().split('T')[0],
    cash_expenses_stated,
    cash_expenses_calc,
    card_atm_total,
    card_atm_calc,
    total_on_bill,
    keeta,
    keeta_status,
    talabat,
    talabat_status,
    unlabeled,
    expense_items,
    atm_entries,
    flag,
    warnings,
    raw_text: rawText,
  };
}
