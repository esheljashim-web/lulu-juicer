'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  DollarSign,
  Coffee,
  Users,
  Store,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Send,
  FileText
} from 'lucide-react';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'slips' | 'review' | 'paste' | 'staff'>('overview');
  const [report, setReport] = useState<any>(null);
  const [days, setDays] = useState<any[]>([]);
  const [reviewItems, setReviewItems] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<any>(null);
  const [pasteText, setPasteText] = useState('');
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [repRes, daysRes, revRes] = await Promise.all([
        fetch('/api/reports/month?month=2026-11'),
        fetch('/api/days'),
        fetch('/api/review'),
      ]);

      if (repRes.ok) setReport(await repRes.json());
      if (daysRes.ok) {
        const dJson = await daysRes.json();
        setDays(dJson.days || []);
      }
      if (revRes.ok) {
        const rJson = await revRes.json();
        setReviewItems(rJson.items || []);
      }
    } catch (err) {
      console.error('Failed fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handlePreview = async () => {
    if (!pasteText.trim()) return;
    try {
      const res = await fetch('/api/slips/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewResult(data.parsed);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmSave = async () => {
    if (!pasteText.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/slips/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
      });
      if (res.ok) {
        showToast('✅ Slip saved successfully!');
        setPasteText('');
        setPreviewResult(null);
        await fetchData();
        setActiveTab('slips');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleResolveReview = async (date: string, action: 'approve' | 'ignore') => {
    try {
      const res = await fetch(`/api/review/${date}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: 'Approved by owner via dashboard' }),
      });
      if (res.ok) {
        showToast(`✅ ${date} approved & verified!`);
        await fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Sample latest day
  const latestDay = days.length > 0 ? days[0] : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-900 text-emerald-100 px-5 py-3 rounded-xl shadow-2xl border border-emerald-700 flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="font-medium text-sm">{notification}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-amber-500/10 text-amber-600 rounded-lg font-bold text-xl">🥤</span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Lulu Juicer Dashboard</h1>
              <p className="text-xs text-slate-500 font-medium">Qatar • Currency: QAR (Riyals)</p>
            </div>
          </div>
        </div>

        {/* Global Controls & Status */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Telegram Live Sync
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-600 shadow-sm transition-all"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="flex space-x-1 sm:space-x-2 my-6 bg-slate-200/70 p-1.5 rounded-xl text-sm font-medium overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-white text-slate-900 shadow-sm font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-amber-600" />
          Numbers & Profit
        </button>
        <button
          onClick={() => setActiveTab('slips')}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'slips'
              ? 'bg-white text-slate-900 shadow-sm font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-4 h-4 text-blue-600" />
          Daily Slips ({days.length})
        </button>
        <button
          onClick={() => setActiveTab('review')}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'review'
              ? 'bg-white text-slate-900 shadow-sm font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Review Queue
          {reviewItems.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-amber-500 text-white rounded-full font-bold">
              {reviewItems.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('paste')}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'paste'
              ? 'bg-white text-slate-900 shadow-sm font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4 text-indigo-600" />
          Paste Slip
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'staff'
              ? 'bg-white text-slate-900 shadow-sm font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4 text-purple-600" />
          Staff & Fixed Costs
        </button>
      </nav>

      {/* TAB 1: OVERVIEW & TILES */}
      {activeTab === 'overview' && report && (
        <div className="space-y-6">
          {/* Top KPI Tiles (Philosophy: Make the Numbers Felt) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Tile 1: Latest Day Snapshot */}
            {latestDay && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  <span>Latest Day Sales</span>
                  <span className="text-amber-600 font-bold">{latestDay.date}</span>
                </div>
                <div className="text-3xl font-black text-slate-900 tracking-tight">
                  QAR {latestDay.total_sales.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                  <span>Shop: QAR {latestDay.total_on_bill.toLocaleString()}</span>
                  <span>•</span>
                  <span>Apps: QAR {(latestDay.keeta + latestDay.talabat).toLocaleString()}</span>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block font-medium">Cash Expenses</span>
                    <span className="text-slate-900 font-bold text-sm">QAR {latestDay.cash_expenses_stated.toLocaleString()}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block font-medium">Card (ATM)</span>
                    <span className="text-slate-900 font-bold text-sm">QAR {latestDay.card_atm_stated.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tile 2: Month-to-Date Performance */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                <span>Month Sales (20 Days)</span>
                <span className="text-emerald-600 font-bold">Nov 2026</span>
              </div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">
                QAR {report.sales.total.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                <span>Avg: QAR {Math.round(report.sales.total / report.days_with_data).toLocaleString()}/day</span>
                <span>•</span>
                <span>96% In-Shop</span>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Shop Counter Sales:</span>
                  <span className="font-bold text-slate-900">QAR {report.sales.shop.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Talabat + Keeta Sales:</span>
                  <span className="font-bold text-slate-900">QAR {(report.sales.keeta + report.sales.talabat).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Tile 3: Cash Drain & Top Supplier Insight */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                <span>Cash Counter Drain</span>
                <span className="text-red-500 font-bold">100% Spent</span>
              </div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">
                QAR {report.costs.cash_counter.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Zero cash left at end of day — all goes to daily supplies.
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-amber-900 bg-amber-50/80 p-2.5 rounded-lg border border-amber-200">
                <span className="font-semibold block">💡 Supplier Drain Insight:</span>
                Rawabi took <strong>QAR 12,221</strong> (41.3% of all counter cash).
              </div>
            </div>
          </div>

          {/* Monthly Profit Reality Tile (P&L Breakdown) */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 md:p-8 rounded-3xl shadow-xl border border-slate-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-700/80 gap-4">
              <div>
                <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-bold tracking-wider uppercase">
                  P&L Reality Check
                </span>
                <h2 className="text-2xl font-bold mt-2">November Estimated Result (20 of 30 Days)</h2>
                <p className="text-slate-400 text-xs mt-1">
                  Accounting formula avoiding double counting of staff salaries & online orders.
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-400 block font-medium">Estimated Balance</span>
                <span className="text-3xl md:text-4xl font-black text-amber-400">
                  {report.profit_estimate < 0 ? `- QAR ${Math.abs(report.profit_estimate).toLocaleString()}` : `QAR ${report.profit_estimate.toLocaleString()}`}
                </span>
                <span className="text-xs text-slate-400 block mt-1">
                  (20 days sales vs full 30 days overhead)
                </span>
              </div>
            </div>

            {/* Profit Formula Elements */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mt-6 text-xs">
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <span className="text-slate-400 block">Total Sales (In)</span>
                <span className="text-emerald-400 font-bold text-base block mt-0.5">
                  + {report.sales.total.toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <span className="text-slate-400 block">Daily Cash Costs</span>
                <span className="text-red-400 font-bold text-base block mt-0.5">
                  - {report.costs.cash_counter.toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <span className="text-slate-400 block">Online (Sadia/Veg)</span>
                <span className="text-red-400 font-bold text-base block mt-0.5">
                  - {report.costs.online_purchases.toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <span className="text-slate-400 block">Fixed Rent & Utility</span>
                <span className="text-red-400 font-bold text-base block mt-0.5">
                  - {report.costs.fixed.toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <span className="text-slate-400 block">Remaining Salaries</span>
                <span className="text-red-400 font-bold text-base block mt-0.5">
                  - {report.costs.salary_remaining.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Decision Next Step */}
            <div className="mt-6 p-4 bg-slate-800/90 rounded-2xl border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 bg-amber-500 text-slate-900 rounded-lg font-bold">🎯</span>
                <div>
                  <span className="font-bold text-slate-200">Decision Target for Next 10 Days:</span>
                  <p className="text-slate-400">
                    Need average sales of <strong>QAR 3,180 / day</strong> across the remaining 10 days to break even.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('review')}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl transition-colors whitespace-nowrap shadow-sm"
              >
                Resolve 4 Pending Slips →
              </button>
            </div>
          </div>

          {/* Supplier Outflow Table */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Store className="w-5 h-5 text-amber-600" />
              Major Outflows & Suppliers (Nov 1 – 20)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold">
                    <th className="pb-3">Supplier / Line</th>
                    <th className="pb-3">Category</th>
                    <th className="pb-3">Total Spent</th>
                    <th className="pb-3">% of Counter Cash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.top_suppliers.map((s: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 font-semibold text-slate-900">{s.supplier}</td>
                      <td className="py-3 text-slate-500">{s.category}</td>
                      <td className="py-3 font-bold text-slate-900">QAR {s.amount.toLocaleString()}</td>
                      <td className="py-3 text-slate-600">
                        {((s.amount / report.costs.cash_counter) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DAILY SLIPS LIST */}
      {activeTab === 'slips' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Recorded Daily Slips</h2>
              <p className="text-xs text-slate-500">20 Days from November 2026</p>
            </div>
            <button
              onClick={() => setActiveTab('paste')}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              + Paste Slip
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Shop Sales</th>
                  <th className="p-3.5">Cash Expenses</th>
                  <th className="p-3.5">Card (ATM)</th>
                  <th className="p-3.5">Keeta</th>
                  <th className="p-3.5">Talabat</th>
                  <th className="p-3.5">Total Sales</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {days.map((day) => (
                  <tr key={day.date} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900">{day.date}</td>
                    <td className="p-3.5 font-semibold text-slate-800">QAR {day.total_on_bill.toLocaleString()}</td>
                    <td className="p-3.5 text-slate-600">QAR {day.cash_expenses_stated.toLocaleString()}</td>
                    <td className="p-3.5 text-slate-600">QAR {day.card_atm_stated.toLocaleString()}</td>
                    <td className="p-3.5 text-slate-600">
                      {day.keeta_status === 'blank' ? (
                        <span className="text-slate-400 italic">Blank</span>
                      ) : day.keeta > 0 ? (
                        `QAR ${day.keeta}`
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-3.5 text-slate-600">
                      {day.talabat > 0 ? `QAR ${day.talabat}` : <span className="text-slate-400">-</span>}
                    </td>
                    <td className="p-3.5 font-bold text-slate-900">QAR {day.total_sales.toLocaleString()}</td>
                    <td className="p-3.5">
                      {day.status === 'ok' || day.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          {day.status === 'approved' ? 'Approved' : 'OK'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle className="w-3 h-3" />
                          Needs Review
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setSelectedDay(day)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-xs transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: REVIEW QUEUE */}
      {activeTab === 'review' && (
        <div className="space-y-5">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <span>
                <strong>Golden Rule:</strong> Never reject or silently alter numbers. Show the difference and let a human approve.
              </span>
            </div>
            <span className="font-bold">{reviewItems.length} Slips Requiring Review</span>
          </div>

          {reviewItems.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="font-bold text-base text-slate-900">All Slips Approved!</h3>
              <p className="text-xs text-slate-500 mt-1">There are no flagged slips pending review.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5">
              {reviewItems.map((item) => (
                <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                    <div>
                      <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Date</span>
                      <h3 className="text-xl font-bold text-slate-900">{item.date}</h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleResolveReview(item.date, 'approve')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Confirm & Approve
                      </button>
                    </div>
                  </div>

                  {/* Discrepancy Reasons */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-slate-500">Why flagged:</span>
                    <ul className="list-disc list-inside text-xs text-red-600 font-medium space-y-1">
                      {item.reasons.map((r: string, idx: number) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Side-by-side: Raw Slip vs Parsed Values */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-xs whitespace-pre-wrap leading-relaxed">
                      <span className="text-slate-400 block font-sans font-bold mb-2">Original Raw Slip:</span>
                      {item.raw_text}
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                      <span className="text-slate-700 font-bold block mb-1">Parsed Financials:</span>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500">Stated Bill Total:</span>
                        <span className="font-bold text-slate-900">QAR {item.parsed.total_on_bill}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500">Stated Cash Expenses:</span>
                        <span className="font-bold text-slate-900">QAR {item.parsed.cash_expenses_stated}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500">Stated ATM (Card):</span>
                        <span className="font-bold text-slate-900">QAR {item.parsed.card_atm_stated}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500">Cash + Card Sum:</span>
                        <span className="font-bold text-slate-900">
                          QAR {item.parsed.cash_expenses_stated + item.parsed.card_atm_stated}
                        </span>
                      </div>
                      {item.parsed.unlabeled > 0 && (
                        <div className="flex justify-between py-1 border-b border-slate-200 text-amber-700 font-semibold">
                          <span>Unlabeled Amount:</span>
                          <span>QAR {item.parsed.unlabeled}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PASTE SLIP BOX */}
      {activeTab === 'paste' && (
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Paste WhatsApp / Telegram Slip</h2>
            <p className="text-xs text-slate-500 mt-1">
              Test or manually add any daily slip text. The rule-based parser extracts numbers instantly with zero errors.
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700">Daily Slip Text:</label>
            <textarea
              rows={8}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`Lulu Juicer | 21 Nov 2026\nExpenses (QAR)\nRawabi – 500\nPT – 20\nTotal expenses – 520\n\nATM (QAR)\n300\n220\nTotal ATM – 520\n\nTotal on bill – QAR 1,040\nKeeta – 50\nTalabat – 30`}
              className="w-full p-4 font-mono text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none bg-slate-50"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePreview}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition-colors"
            >
              Parse Preview
            </button>
            <button
              onClick={handleConfirmSave}
              disabled={saving || !pasteText.trim()}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-colors shadow-sm disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Confirm & Save Slip'}
            </button>
          </div>

          {/* Parsed Preview Output */}
          {previewResult && (
            <div className="mt-6 p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-700">Parsed Preview:</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                    previewResult.flag === 'ok' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  Status: {previewResult.flag}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block">Date</span>
                  <span className="font-bold text-slate-900">{previewResult.date}</span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block">Shop Bill</span>
                  <span className="font-bold text-slate-900">QAR {previewResult.total_on_bill}</span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block">Cash Expenses</span>
                  <span className="font-bold text-slate-900">QAR {previewResult.cash_expenses_stated}</span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block">Card (ATM)</span>
                  <span className="font-bold text-slate-900">QAR {previewResult.card_atm_total}</span>
                </div>
              </div>

              {previewResult.expense_items.length > 0 && (
                <div className="pt-2">
                  <span className="text-xs font-bold text-slate-600 block mb-2">
                    Expense Line Items ({previewResult.expense_items.length}):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {previewResult.expense_items.map(([lbl, amt]: [string, number], idx: number) => (
                      <span key={idx} className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium">
                        {lbl}: <strong>QAR {amt}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: STAFF & FIXED COSTS */}
      {activeTab === 'staff' && report && (
        <div className="space-y-6">
          {/* Staff Payroll Table */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">12 Staff Payroll & Counter Advances</h3>
                <p className="text-xs text-slate-500">Total Monthly Salary: QAR 23,000</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Counter Advances Taken</span>
                <span className="text-base font-bold text-amber-600">
                  QAR {report.costs.counter_salaries_taken.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold">
                    <th className="pb-3">Staff Name</th>
                    <th className="pb-3">Monthly Due</th>
                    <th className="pb-3">Taken From Counter</th>
                    <th className="pb-3">Remaining Balance</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.staff.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 font-semibold text-slate-900">{s.name}</td>
                      <td className="py-3 text-slate-700">QAR {s.monthly_salary.toLocaleString()}</td>
                      <td className="py-3 font-bold text-amber-600">
                        {s.taken_from_counter > 0 ? `QAR ${s.taken_from_counter.toLocaleString()}` : '-'}
                      </td>
                      <td className="py-3 font-bold text-slate-900">QAR {s.balance_remaining.toLocaleString()}</td>
                      <td className="py-3">
                        {s.balance_remaining === 0 ? (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-bold text-[10px]">
                            Fully Paid
                          </span>
                        ) : s.taken_from_counter > 0 ? (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-bold text-[10px]">
                            Partially Paid
                          </span>
                        ) : (
                          <span className="text-slate-400">Full Due</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fixed Monthly Overheads */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-3">Fixed Monthly Costs (QAR 20,112)</h3>
              <div className="space-y-2 text-xs divide-y divide-slate-100">
                {report.fixed_costs.map((f: any, idx: number) => (
                  <div key={idx} className="flex justify-between pt-2">
                    <span className="text-slate-600">{f.label}</span>
                    <span className="font-bold text-slate-900">QAR {f.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-3">Online Purchases (Sadia & Veg)</h3>
              <div className="space-y-2 text-xs divide-y divide-slate-100">
                {report.online_purchases.map((p: any, idx: number) => (
                  <div key={idx} className="flex justify-between pt-2">
                    <div>
                      <span className="font-semibold text-slate-800 block">{p.supplier}</span>
                      <span className="text-slate-400 text-[11px]">{p.date}</span>
                    </div>
                    <span className="font-bold text-slate-900">QAR {p.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slip Inspector Modal */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold text-amber-600 uppercase">Daily Slip</span>
                <h3 className="text-xl font-bold text-slate-900">{selectedDay.date}</h3>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 block">Shop Bill:</span>
                <span className="text-base font-bold text-slate-900">QAR {selectedDay.total_on_bill}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 block">Total Sales:</span>
                <span className="text-base font-bold text-slate-900">QAR {selectedDay.total_sales}</span>
              </div>
            </div>

            {selectedDay.raw_text && (
              <div>
                <span className="text-xs font-bold text-slate-600 block mb-1">Raw Slip Text:</span>
                <div className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-xs whitespace-pre-wrap leading-relaxed">
                  {selectedDay.raw_text}
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedDay(null)}
              className="w-full py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
