import { Pool } from 'pg';
import { getSeedData, SeedData } from './seedData';

// Global pool for serverless environments
let pool: Pool | null = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  });
}

// In-Memory store fallback
class MemoryStore {
  data: SeedData;
  rawMessages: any[] = [];
  auditLog: any[] = [];

  constructor() {
    this.data = getSeedData();
  }

  getDays(from?: string, to?: string) {
    let list = [...this.data.slips];
    if (from) list = list.filter(d => d.date >= from);
    if (to) list = list.filter(d => d.date <= to);
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }

  getDay(date: string) {
    const day = this.data.slips.find(d => d.date === date);
    if (!day) return null;
    const items = this.data.items.filter(i => i.date === date);
    return {
      ...day,
      items,
      card_entries: (day.atm_entries || []).map((amt: number, idx: number) => ({ id: `card-${date}-${idx}`, amount: amt })),
      raw_message: { text: day.raw_text, date: day.date },
    };
  }

  upsertDay(slipData: any, itemsData: any[]) {
    const existingIdx = this.data.slips.findIndex(d => d.date === slipData.date);
    if (existingIdx >= 0) {
      this.data.slips[existingIdx] = {
        ...this.data.slips[existingIdx],
        ...slipData,
        version: (this.data.slips[existingIdx].version || 1) + 1,
        updated_at: new Date().toISOString(),
      };
    } else {
      this.data.slips.push({
        ...slipData,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // Replace items
    this.data.items = this.data.items.filter(i => i.date !== slipData.date);
    itemsData.forEach((item, idx) => {
      this.data.items.push({
        id: `${slipData.date}-${idx}`,
        date: slipData.date,
        ...item,
      });
    });

    return this.getDay(slipData.date);
  }

  getReviewQueue() {
    const flaggedDays = this.data.slips.filter(d => d.status === 'needs_review' || d.flag === 'needs_review');
    return flaggedDays.map(d => {
      const reasons: string[] = [];
      if (d.unlabeled > 0) reasons.push(`Unlabeled amount: QAR ${d.unlabeled}`);
      if (d.items_diff !== 0) reasons.push(`Items difference: QAR ${d.items_diff}`);
      if (d.bill_diff !== 0) reasons.push(`Bill mismatch: QAR ${d.bill_diff}`);
      if (reasons.length === 0) reasons.push('Flagged for manual verification');

      return {
        id: d.date,
        type: 'daily_slip',
        date: d.date,
        flag: d.flag,
        reasons,
        raw_text: d.raw_text,
        parsed: d,
      };
    });
  }

  resolveReview(date: string, action: 'approve' | 'edit' | 'ignore', changes?: any, reason?: string) {
    const day = this.data.slips.find(d => d.date === date);
    if (!day) return false;

    if (action === 'approve') {
      day.status = 'approved';
      day.flag = 'ok';
    } else if (action === 'edit' && changes) {
      Object.assign(day, changes);
      day.status = 'approved';
      day.flag = 'ok';
    } else if (action === 'ignore') {
      day.status = 'ignored';
    }

    this.auditLog.push({
      date,
      action,
      reason: reason || 'Resolved by user',
      at: new Date().toISOString(),
    });

    return true;
  }

  getMonthReport(monthStr: string = '2026-11') {
    const days = this.data.slips.filter(d => d.date.startsWith(monthStr));
    const shopSales = days.reduce((sum, d) => sum + (d.total_on_bill || 0), 0);
    const keetaSales = days.reduce((sum, d) => sum + (d.keeta || 0), 0);
    const talabatSales = days.reduce((sum, d) => sum + (d.talabat || 0), 0);
    const totalSales = shopSales + keetaSales + talabatSales;
    const cash = days.reduce((sum, d) => sum + (d.cash_expenses_stated || 0), 0);
    const card = days.reduce((sum, d) => sum + (d.card_atm_stated || 0), 0);

    const onlineTotal = this.data.onlinePurchases.reduce((sum, p) => sum + (p.amount || 0), 0);
    const fixedTotal = this.data.fixedCosts.reduce((sum, f) => sum + (f.amount || 0), 0);

    // Counter salaries taken
    const counterSalaries = this.data.items
      .filter(i => i.is_salary && i.date.startsWith(monthStr))
      .reduce((sum, i) => sum + (i.amount || 0), 0);

    const monthlySalaryMaster = this.data.staff.reduce((sum, s) => sum + s.monthly_salary, 0); // 23,000
    const remainingSalaryDue = Math.max(0, monthlySalaryMaster - counterSalaries);

    const profitEstimate = totalSales - cash - onlineTotal - fixedTotal - remainingSalaryDue;

    return {
      month: monthStr,
      days_with_data: days.length,
      days_missing: ['2026-11-21', '2026-11-22'],
      sales: {
        shop: shopSales,
        keeta: keetaSales,
        talabat: talabatSales,
        total: totalSales,
        unlabeled: days.reduce((sum, d) => sum + (d.unlabeled || 0), 0),
      },
      cash,
      card,
      costs: {
        cash_counter: cash,
        online_purchases: onlineTotal,
        fixed: fixedTotal,
        salary_remaining: remainingSalaryDue,
        counter_salaries_taken: counterSalaries,
      },
      profit_estimate: profitEstimate,
      data_quality: {
        needs_review_days: days.filter(d => d.status === 'needs_review').length,
        approved_days: days.filter(d => d.status === 'approved').length,
        ok_days: days.filter(d => d.status === 'ok').length,
      },
      staff: this.data.staff.map(s => {
        const taken = this.data.items
          .filter(i => i.staff_id === s.id && i.date.startsWith(monthStr))
          .reduce((sum, i) => sum + i.amount, 0);
        return {
          ...s,
          taken_from_counter: taken,
          balance_remaining: Math.max(0, s.monthly_salary - taken),
        };
      }),
      top_suppliers: [
        { supplier: 'Rawabi', amount: 12221, category: 'Ingredients' },
        { supplier: 'Firdous', amount: 1655, category: 'Ingredients' },
        { supplier: 'Royal Pack', amount: 906, category: 'Packaging' },
        { supplier: 'Sulthan', amount: 231, category: 'Packaging' },
        { supplier: 'PT (Fuel)', amount: 377, category: 'Fuel' },
      ],
      fixed_costs: this.data.fixedCosts,
      online_purchases: this.data.onlinePurchases,
    };
  }
}

// Global singleton for memory store
const globalStore = (global as any).__lulu_store || new MemoryStore();
if (process.env.NODE_ENV !== 'production') {
  (global as any).__lulu_store = globalStore;
}

export const db = {
  isPostgres: !!pool,
  pool,
  store: globalStore,
};
