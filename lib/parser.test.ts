import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseDailySlip } from './parser';

describe('Lulu Juicer Slip Parser', () => {
  const seedPath = path.resolve(__dirname, '../seed/raw_slips_nov2026.jsonl');
  const fileContent = fs.readFileSync(seedPath, 'utf-8');
  const fixtures = fileContent
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => JSON.parse(line));

  it('correctly loads all 20 fixtures', () => {
    expect(fixtures.length).toBe(20);
  });

  fixtures.forEach((fixture, idx) => {
    const { date, raw_text, expected } = fixture;

    it(`passes fixture ${idx + 1} (${date})`, () => {
      const parsed = parseDailySlip(raw_text);

      expect(parsed.date).toBe(date);
      expect(parsed.cash_expenses_stated).toBe(expected.cash_expenses_stated);
      expect(parsed.card_atm_total).toBe(expected.card_atm_total);
      expect(parsed.total_on_bill).toBe(expected.total_on_bill);
      expect(parsed.keeta).toBe(expected.keeta);
      expect(parsed.keeta_status).toBe(expected.keeta_status);
      expect(parsed.talabat).toBe(expected.talabat);
      expect(parsed.talabat_status).toBe(expected.talabat_status);
      expect(parsed.unlabeled).toBe(expected.unlabeled);
      expect(parsed.expense_items).toEqual(expected.expense_items);
      expect(parsed.atm_entries).toEqual(expected.atm_entries);
      expect(parsed.flag).toBe(expected.expected_flag);
    });
  });
});
