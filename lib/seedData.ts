import fs from 'fs';
import path from 'path';
import { parseDailySlip } from './parser';

export interface SeedData {
  slips: any[];
  items: any[];
  staff: any[];
  fixedCosts: any[];
  onlinePurchases: any[];
  aliases: any[];
}

export function getSeedData(): SeedData {
  const seedPath = path.resolve(process.cwd(), 'seed/raw_slips_nov2026.jsonl');
  let rawSlipsLines: string[] = [];

  try {
    if (fs.existsSync(seedPath)) {
      rawSlipsLines = fs.readFileSync(seedPath, 'utf-8').split('\n').filter(l => l.trim().length > 0);
    }
  } catch (err) {
    console.error('Failed reading seed file:', err);
  }

  const slips: any[] = [];
  const items: any[] = [];

  // Alias lookup map
  const ALIAS_CATEGORY_MAP: Record<string, { norm: string; cat: string; supp?: string; isSalary?: boolean; staffId?: string }> = {
    'rawabi': { norm: 'Rawabi', cat: 'Ingredients', supp: 'Rawabi' },
    'firdous': { norm: 'Firdous', cat: 'Ingredients', supp: 'Firdous' },
    'emdadco': { norm: 'Emdadco', cat: 'Ingredients', supp: 'Emdadco' },
    'emdadco (name unclear)': { norm: 'Emdadco', cat: 'Ingredients', supp: 'Emdadco' },
    'royal pack': { norm: 'Royal Pack', cat: 'Packaging', supp: 'Royal Pack' },
    'sulthan': { norm: 'Sulthan', cat: 'Packaging', supp: 'Sulthan' },
    'sulthan plastic': { norm: 'Sulthan', cat: 'Packaging', supp: 'Sulthan' },
    'pt': { norm: 'PT', cat: 'Fuel' },
    'bakery': { norm: 'Bakery', cat: 'Supplies' },
    'bread': { norm: 'Bread', cat: 'Ingredients' },
    'baladna': { norm: 'Baladna', cat: 'Ingredients' },
    'store': { norm: 'Store', cat: 'Supplies' },
    'family': { norm: 'Family', cat: 'Counter Outflow' },
    'mayonnaise': { norm: 'Mayonnaise', cat: 'Ingredients' },
    'chips': { norm: 'Chips', cat: 'Ingredients' },
    'cheese': { norm: 'Cheese', cat: 'Ingredients' },
    'beef keema': { norm: 'Beef keema', cat: 'Ingredients' },
    'samosa': { norm: 'Samosa', cat: 'Ingredients' },
    'zinger': { norm: 'Zinger', cat: 'Ingredients' },
    'garmet': { norm: 'Garmet', cat: 'Supplies' },
    'tissue': { norm: 'Tissue', cat: 'Supplies' },
    'water': { norm: 'Water', cat: 'Supplies' },
    'bike repair': { norm: 'Bike repair', cat: 'Repairs' },
    'a/c repair': { norm: 'A/C repair', cat: 'Repairs' },
    'panasonic blender': { norm: 'Panasonic blender', cat: 'Equipment' },
    'marwa': { norm: 'Marwa', cat: 'Supplies' },
    'item unclear': { norm: 'Item unclear', cat: 'Uncategorised' },
    'mijan salary': { norm: 'Meezan', cat: 'Salary', isSalary: true, staffId: 'meezan' },
    'basheer salary': { norm: 'Basheerka', cat: 'Salary', isSalary: true, staffId: 'basheerka' },
    'salary (name unclear)': { norm: 'Salary (name unclear)', cat: 'Salary', isSalary: true },
  };

  rawSlipsLines.forEach(line => {
    const json = JSON.parse(line);
    const parsed = parseDailySlip(json.raw_text);

    slips.push({
      date: parsed.date,
      cash_expenses_stated: parsed.cash_expenses_stated,
      cash_expenses_calc: parsed.cash_expenses_calc,
      card_atm_stated: parsed.card_atm_total,
      card_atm_calc: parsed.card_atm_calc,
      total_on_bill: parsed.total_on_bill,
      total_on_bill_source: 'stated',
      keeta: parsed.keeta,
      keeta_status: parsed.keeta_status,
      talabat: parsed.talabat,
      talabat_status: parsed.talabat_status,
      unlabeled: parsed.unlabeled,
      total_sales: parsed.total_on_bill + parsed.keeta + parsed.talabat,
      bill_diff: parsed.total_on_bill - (parsed.cash_expenses_stated + parsed.card_atm_total),
      items_diff: parsed.cash_expenses_calc - parsed.cash_expenses_stated,
      atm_diff: parsed.atm_entries.length > 0 ? parsed.card_atm_calc - parsed.card_atm_total : 0,
      flag: parsed.flag,
      status: parsed.flag,
      version: 1,
      raw_text: json.raw_text,
      atm_entries: parsed.atm_entries,
    });

    parsed.expense_items.forEach(([label, amount], idx) => {
      const lower = label.toLowerCase();
      const meta = ALIAS_CATEGORY_MAP[lower] || { norm: label, cat: 'Uncategorised' };
      items.push({
        id: `${parsed.date}-${idx}`,
        date: parsed.date,
        label_raw: label,
        label_normalized: meta.norm,
        category: meta.cat,
        supplier: meta.supp || null,
        staff_id: meta.staffId || null,
        amount,
        is_salary: !!meta.isSalary,
        position: idx,
      });
    });
  });

  const staff = [
    { id: 'janid', name: 'Janid', aliases: [], monthly_salary: 3000, active: true },
    { id: 'shamnad', name: 'Shamnad', aliases: [], monthly_salary: 2200, active: true },
    { id: 'asarudheen', name: 'Asarudheen', aliases: [], monthly_salary: 1800, active: true },
    { id: 'nasseer', name: 'Nasseer', aliases: [], monthly_salary: 2000, active: true },
    { id: 'saddam', name: 'Saddam', aliases: [], monthly_salary: 1500, active: true },
    { id: 'sameer', name: 'Sameer', aliases: [], monthly_salary: 1600, active: true },
    { id: 'afnas', name: 'Afnas', aliases: [], monthly_salary: 1600, active: true },
    { id: 'farbi', name: 'Farbi', aliases: [], monthly_salary: 1700, active: true },
    { id: 'basheerka', name: 'Basheerka', aliases: ['Basheer'], monthly_salary: 2700, active: true },
    { id: 'shafnas', name: 'Shafnas', aliases: [], monthly_salary: 1100, active: true },
    { id: 'meezan', name: 'Meezan', aliases: ['Mijan'], monthly_salary: 1800, active: true },
    { id: 'ishaq', name: 'Ishaq', aliases: [], monthly_salary: 2000, active: true },
  ];

  const fixedCosts = [
    { month: '2026-11-01', type: 'shop_rent', label: 'Shop Rent', amount: 8712 },
    { month: '2026-11-01', type: 'room_rent', label: 'Room Rent', amount: 4600 },
    { month: '2026-11-01', type: 'electricity', label: 'Kahrama (Electricity)', amount: 4200 },
    { month: '2026-11-01', type: 'phone', label: 'Phone', amount: 1100 },
    { month: '2026-11-01', type: 'sponsor_fee', label: 'Sponsor Fee', amount: 1500 },
  ];

  const onlinePurchases = [
    { date: '2026-11-01', supplier: 'Sadia', amount: 2289, notes: '01 nov Sadia - 2289' },
    { date: '2026-11-01', supplier: 'Fruits & Veg', amount: 1785, notes: '01 -novmber fruits 1785' },
    { date: '2026-11-07', supplier: 'Fruits & Veg', amount: 2032, notes: '07 novemever Fruits n veg - 2032' },
    { date: '2026-11-14', supplier: 'Sadia', amount: 1723, notes: '14 nov Sadia -1723' },
    { date: '2026-11-14', supplier: 'Fruits & Veg', amount: 1930, notes: '14 nov fruits 1930 qar' },
  ];

  const aliases = Object.entries(ALIAS_CATEGORY_MAP).map(([raw, val]) => ({
    label_raw: raw,
    label_normalized: val.norm,
    category: val.cat,
    supplier: val.supp || null,
    confirmed: true,
  }));

  return { slips, items, staff, fixedCosts, onlinePurchases, aliases };
}
