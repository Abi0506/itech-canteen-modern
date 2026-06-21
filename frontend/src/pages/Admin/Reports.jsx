import React, { useEffect, useMemo, useState, useCallback } from 'react';
import api from '../../utils/api';
import { TrendingUp, ShoppingBag, DollarSign, Users, Calendar, BarChart2, Download } from 'lucide-react';

const formatCurrency = (value) => `Rs.${Number(value || 0).toFixed(2)}`;

/* ─────────────────────────────────────────────
   SVG Bar Chart Component
   Shows single bars with a toggle between Revenue and Sales qty, 
   using HTML tooltips to prevent clipping.
───────────────────────────────────────────── */
const BarChart = ({ data }) => {
  const [hovered, setHovered] = useState(null);
  const [activeMetric, setActiveMetric] = useState('revenue');

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-secondary text-sm">
        No sales data found for this period.
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d[activeMetric]), 1);
  const BAR_H = 200;
  const BAR_W = 36; // Slightly wider for a single bar
  const GAP = 20;
  const LABEL_H = 44;
  const PADDING_L = 56;
  const PADDING_R = 20;
  const totalW = PADDING_L + data.length * (BAR_W + GAP) + PADDING_R;

  const primaryColor = '#9f402d';   // primary
  const secondaryColor = '#006b5b'; // tertiary (teal accent)

  const activeColor = activeMetric === 'revenue' ? primaryColor : secondaryColor;

  return (
    <div>
      {/* Metric Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
            activeMetric === 'revenue' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-secondary hover:text-primary'
          }`}
          onClick={() => setActiveMetric('revenue')}
        >
          Revenue (Rs.)
        </button>
        <button
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
            activeMetric === 'quantity' ? 'bg-[#006b5b] text-on-primary' : 'bg-surface-container-high text-secondary hover:text-[#006b5b]'
          }`}
          onClick={() => setActiveMetric('quantity')}
        >
          Units Sold
        </button>
      </div>

      <div className="overflow-x-auto relative">
        <svg
          width={totalW}
          height={BAR_H + LABEL_H + 20}
          style={{ minWidth: Math.min(totalW, 600) }}
        >
          {/* Y-axis grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = 10 + (1 - pct) * BAR_H;
            return (
              <g key={pct}>
                <line
                  x1={PADDING_L - 8}
                  x2={totalW - PADDING_R}
                  y1={y}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth={1}
                  strokeDasharray={pct === 0 ? '0' : '4 3'}
                />
                <text x={PADDING_L - 12} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
                  {pct === 0 
                    ? '0' 
                    : activeMetric === 'revenue' 
                      ? formatCurrency(maxValue * pct).replace('Rs.', '₹')
                      : Math.round(maxValue * pct)}
                </text>
              </g>
            );
          })}

          {data.map((item, i) => {
            const x = PADDING_L + i * (BAR_W + GAP);
            const valH = Math.max(2, (item[activeMetric] / maxValue) * BAR_H);
            const isHovered = hovered === i;

            return (
              <g
                key={item.name}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Bar */}
                <rect
                  x={x}
                  y={10 + BAR_H - valH}
                  width={BAR_W}
                  height={valH}
                  rx={4}
                  fill={activeColor}
                  opacity={isHovered ? 1 : 0.82}
                />

                {/* X-axis label */}
                <text
                  x={x + BAR_W / 2}
                  y={10 + BAR_H + 14}
                  textAnchor="middle"
                  fontSize={8.5}
                  fill="#6b7280"
                  transform={`rotate(-30, ${x + BAR_W / 2}, ${10 + BAR_H + 14})`}
                >
                  {item.name.length > 12 ? item.name.slice(0, 12) + '…' : item.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* HTML Tooltip on hover */}
        {hovered !== null && (
          <div
            className="absolute pointer-events-none bg-gray-800 text-white rounded-lg p-3 shadow-lg z-10"
            style={{
              left: Math.max(10, PADDING_L + hovered * (BAR_W + GAP) + BAR_W / 2 - 80),
              bottom: LABEL_H + 30 + Math.max(2, (data[hovered][activeMetric] / maxValue) * BAR_H),
              width: 160,
              transform: 'translateY(-10px)'
            }}
          >
            <p className="text-xs font-bold text-center mb-1 truncate">
              {data[hovered].name}
            </p>
            <p className="text-[10px] text-gray-300 text-center">
              Revenue: {formatCurrency(data[hovered].revenue)}
            </p>
            <p className="text-[10px] text-gray-300 text-center">
              Sales: {data[hovered].quantity} units
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Pie Chart Component (unchanged logic, improved style)
───────────────────────────────────────────── */
const PieChartCard = ({ data }) => {
  const total = data.reduce((sum, item) => sum + Number(item.revenue || 0), 0);
  const colors = [
    '#9f402d', // primary
    '#e2725b', // primary-container
    '#006b5b', // tertiary
    '#ffb4a5', // primary-fixed-dim
    '#00a58e', // tertiary-container
    '#802918', // on-primary-fixed-variant
  ];

  let cumulative = 0;
  const slices = data.map((item, index) => {
    const value = Number(item.revenue || 0);
    const percentage = total > 0 ? value / total : 0;
    const start = cumulative;
    cumulative += percentage;
    const end = cumulative;
    const largeArc = end - start > 0.5 ? 1 : 0;
    const startAngle = start * Math.PI * 2 - Math.PI / 2;
    const endAngle = end * Math.PI * 2 - Math.PI / 2;
    const x1 = 50 + Math.cos(startAngle) * 42;
    const y1 = 50 + Math.sin(startAngle) * 42;
    const x2 = 50 + Math.cos(endAngle) * 42;
    const y2 = 50 + Math.sin(endAngle) * 42;
    const path =
      percentage === 0 ? null : `M 50 50 L ${x1} ${y1} A 42 42 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { ...item, color: colors[index % colors.length], path, percentage };
  });

  return (
    <div className="space-y-4">
      {total > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-center">
          <div className="flex justify-center">
            <svg viewBox="0 0 100 100" className="w-44 h-44 drop-shadow-sm">
              {slices.map((slice) =>
                slice.path ? <path key={slice.name} d={slice.path} fill={slice.color} /> : null,
              )}
              <circle cx="50" cy="50" r="22" fill="white" />
              <text x="50" y="47" textAnchor="middle" className="fill-[#1f2937]" fontSize="6.5" fontWeight="700">
                Total
              </text>
              <text x="50" y="56" textAnchor="middle" className="fill-[#1f2937]" fontSize="6" fontWeight="700">
                {formatCurrency(total)}
              </text>
            </svg>
          </div>
          <div className="space-y-2">
            {slices.map((slice) => (
              <div
                key={slice.name}
                className="flex items-center justify-between gap-4 rounded-xl border border-outline/10 bg-surface p-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                  <div>
                    <p className="font-semibold text-on-surface text-sm">{slice.name}</p>
                    <p className="text-[10px] text-secondary">{(slice.percentage * 100).toFixed(1)}% of revenue</p>
                  </div>
                </div>
                <p className="font-bold text-on-surface text-sm shrink-0">{formatCurrency(slice.revenue)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-secondary">No category sales for this period.</p>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────
   Main Reports Page
───────────────────────────────────────────── */
const Reports = () => {
  const today = new Date().toISOString().split('T')[0];
  const sevenAgo = new Date(Date.now() - 6 * 864e5).toISOString().split('T')[0];

  const [dashboard, setDashboard] = useState(null);
  const [dateFrom, setDateFrom] = useState(sevenAgo);
  const [dateTo, setDateTo] = useState(today);
  const [exportDate, setExportDate] = useState(today);

  // Date-filtered data
  const [itemSales, setItemSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [loadingStatic, setLoadingStatic] = useState(true);
  const [loadingFiltered, setLoadingFiltered] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [loadError, setLoadError] = useState('');

  const fetchDashboard = useCallback(async () => {
    const res = await api.get('/reports/dashboard');
    setDashboard(res.data);
  }, []);

  const fetchFiltered = useCallback(async () => {
    setLoadingFiltered(true);
    setLoadError('');
    try {
      const params = { date_from: dateFrom, date_to: dateTo };
      const [itemRes, prodRes, catRes] = await Promise.all([
        api.get('/reports/item-sales', { params }),
        api.get('/reports/top-products', { params }),
        api.get('/reports/top-categories', { params }),
      ]);
      setItemSales(itemRes.data || []);
      setProducts(prodRes.data || []);
      setCategories(catRes.data || []);
    } catch (e) {
      setLoadError('Could not load filtered report data.');
    } finally {
      setLoadingFiltered(false);
    }
  }, [dateFrom, dateTo]);

  const fetchTransactions = useCallback(async (selectedDate = exportDate) => {
    setLoadingTransactions(true);
    setLoadError('');
    try {
      const res = await api.get('/reports/transactions', { params: { report_date: selectedDate } });
      setTransactions(res.data?.transactions || []);
    } catch (e) {
      setTransactions([]);
      setLoadError('Could not load transaction history.');
    } finally {
      setLoadingTransactions(false);
    }
  }, [exportDate]);

  const refreshReports = useCallback(async () => {
    await Promise.allSettled([
      fetchDashboard(),
      fetchFiltered(),
      fetchTransactions(exportDate),
    ]);
  }, [exportDate, fetchDashboard, fetchFiltered, fetchTransactions]);

  useEffect(() => {
    let mounted = true;
    const loadInitial = async () => {
      try {
        await Promise.allSettled([
          fetchDashboard(),
          fetchFiltered(),
          fetchTransactions(exportDate),
        ]);
      } finally {
        if (mounted) {
          setLoadingStatic(false);
        }
      }
    };

    loadInitial();

    const socket = new WebSocket('ws://localhost:8000/ws/admin');
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (['payment_completed', 'order_sent_to_kitchen', 'cart_updated'].includes(payload.event)) {
          refreshReports();
        }
      } catch (err) {
        // ignore malformed messages
      }
    };

    const pollId = window.setInterval(refreshReports, 30000);

    return () => {
      mounted = false;
      socket.close();
      window.clearInterval(pollId);
    };
  }, [exportDate, fetchDashboard, fetchFiltered, fetchTransactions, refreshReports]);

  useEffect(() => {
    fetchFiltered();
  }, [fetchFiltered]);

  useEffect(() => {
    fetchTransactions(exportDate);
  }, [exportDate, fetchTransactions]);

  const handleDownloadPdf = async () => {
    setPdfBusy(true);
    setLoadError('');
    try {
      const res = await api.get('/reports/transactions/pdf', {
        params: { report_date: exportDate },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transaction-history-${exportDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setLoadError('Could not download PDF report.');
    } finally {
      setPdfBusy(false);
    }
  };

  if (loadingStatic) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 font-body">
      {/* Header */}
      <div>
        <h1 className="font-headline font-bold text-2xl text-on-surface">Reports &amp; Analytics</h1>
        <p className="text-secondary text-sm mt-0.5">
          Revenue trends, item performance, and category metrics — filtered by date range.
        </p>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
          {loadError}
        </div>
      )}

      {/* KPI Cards (all-time, not date filtered) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {[
          { label: 'All-Time Revenue', value: formatCurrency(dashboard?.all_time_revenue), Icon: DollarSign },
          { label: 'All-Time Orders', value: dashboard?.all_time_orders ?? 0, Icon: ShoppingBag },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="bg-surface-container-low border border-outline/10 p-5 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-outline text-[10px] font-bold uppercase tracking-wider">{label}</p>
              <p className="font-headline text-2xl font-black text-on-surface mt-1">{value}</p>
            </div>
            <div className="p-3 bg-primary/5 text-primary rounded-full">
              <Icon size={20} />
            </div>
          </div>
        ))}
      </div>

      {/* ── PDF Export ── */}
      <div className="flex flex-col gap-4 p-5 bg-surface-container-low border border-outline/10 rounded-2xl lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <Download size={18} />
            Transaction PDF Export
          </div>
          <p className="text-xs text-secondary mt-1">
            Choose a specific date to download the transaction history with user and payment details.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div>
            <label className="block text-[10px] font-bold uppercase text-secondary mb-1">Date</label>
            <input
              type="date"
              value={exportDate}
              max={today}
              onChange={(e) => setExportDate(e.target.value)}
              className="px-3 py-2 bg-surface border border-outline/10 rounded-xl text-sm outline-none focus:border-primary/40"
            />
          </div>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={pdfBusy}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow hover:bg-primary/95 disabled:opacity-50"
          >
            <Download size={16} />
            {pdfBusy ? 'Preparing PDF...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* ── Date Range Filter ── */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 p-5 bg-surface-container-low border border-outline/10 rounded-2xl">
        <div className="flex items-center gap-2 text-primary font-bold text-sm">
          <Calendar size={18} />
          Date Filter
        </div>
        <div className="flex flex-wrap gap-4 flex-1">
          <div>
            <label className="block text-[10px] font-bold uppercase text-secondary mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 bg-surface border border-outline/10 rounded-xl text-sm outline-none focus:border-primary/40"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-secondary mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              max={today}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 bg-surface border border-outline/10 rounded-xl text-sm outline-none focus:border-primary/40"
            />
          </div>
        </div>
        <p className="text-[11px] text-secondary">
          Showing data from <strong>{dateFrom}</strong> to <strong>{dateTo}</strong>
        </p>
        {loadingFiltered && (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
        )}
      </div>

      {/* ── Bar Chart: All Items Revenue & Sales ── */}
      <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 size={18} className="text-primary" />
            <div>
              <h3 className="font-headline font-bold text-sm text-on-surface">Item Revenue &amp; Sales Volume</h3>
              <p className="text-[10px] text-secondary mt-0.5">Hover over bars for details · Sorted by revenue</p>
            </div>
          </div>
          <span className="text-[10px] bg-primary/10 text-primary font-bold px-2.5 py-1 rounded-full">
            {itemSales.length} items
          </span>
        </div>
        <BarChart data={itemSales} />
      </div>

      {/* ── Top 5 + Pie Chart (side by side) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top 5 Best Selling */}
        <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4">
          <h3 className="font-headline font-bold text-sm text-on-surface border-b border-outline/5 pb-2">
            Top 5 Best Selling Products
          </h3>
          <div className="space-y-3">
            {products.map((p, idx) => {
              const maxQty = products[0]?.quantity || 1;
              const barPct = Math.round((p.quantity / maxQty) * 100);
              return (
                <div key={p.name} className="space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-semibold text-on-surface flex items-center gap-2">
                      <span className="text-xs bg-primary/10 text-primary w-5 h-5 flex items-center justify-center rounded-full font-bold shrink-0">
                        {idx + 1}
                      </span>
                      {p.name}
                    </span>
                    <div className="text-right shrink-0 ml-2">
                      <span className="font-bold text-on-surface text-xs">{formatCurrency(p.revenue)}</span>
                      <span className="text-outline text-[10px] ml-2">{p.quantity} units</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/70 rounded-full transition-all duration-500"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {products.length === 0 && (
              <p className="text-xs text-outline italic">No sales in this period.</p>
            )}
          </div>
        </div>

        {/* Category Revenue Mix */}
        <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4">
          <h3 className="font-headline font-bold text-sm text-on-surface border-b border-outline/5 pb-2">
            Category Revenue Mix
          </h3>
          <PieChartCard data={categories} />
        </div>
      </div>

      {/* ── Transaction History ── */}
      <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-headline font-bold text-sm text-on-surface">Transaction History</h3>
            <p className="text-[10px] text-secondary mt-0.5">
              Detailed order, customer, user, and payment information for {exportDate}.
            </p>
          </div>
          {loadingTransactions && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-outline/10">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high text-[10px] uppercase tracking-wider text-outline">
                <th className="p-3 font-bold">Order</th>
                <th className="p-3 font-bold">Table</th>
                <th className="p-3 font-bold">Customer</th>
                <th className="p-3 font-bold">Cashier</th>
                <th className="p-3 font-bold">Payment</th>
                <th className="p-3 font-bold">Total</th>
                <th className="p-3 font-bold">Time</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn) => (
                <tr key={txn.id} className="border-t border-outline/10 text-sm">
                  <td className="p-3 font-semibold text-on-surface">{txn.order_number}</td>
                  <td className="p-3 text-secondary">{txn.table?.table_number || '-'}</td>
                  <td className="p-3 text-secondary">
                    <div className="font-medium text-on-surface">{txn.customer?.name || 'Walk-in'}</div>
                    <div className="text-[10px] text-outline">{txn.customer?.mobile_number || '-'}</div>
                  </td>
                  <td className="p-3 text-secondary">
                    <div className="font-medium text-on-surface">{txn.cashier?.name || '-'}</div>
                    <div className="text-[10px] text-outline">
                      {txn.waiter?.name ? `Waiter: ${txn.waiter.name}` : 'Cashier order'}
                    </div>
                  </td>
                  <td className="p-3 text-secondary">
                    <div className="font-medium text-on-surface">{txn.payment?.method?.display_name || txn.payment?.method?.type || '-'}</div>
                    <div className="text-[10px] text-outline">{txn.payment?.reference_code || 'Recorded payment'}</div>
                  </td>
                  <td className="p-3 font-semibold text-on-surface">{formatCurrency(txn.total)}</td>
                  <td className="p-3 text-secondary text-xs">{txn.created_at ? new Date(txn.created_at).toLocaleString() : '-'}</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-outline italic text-xs">No transactions found for this date.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;
