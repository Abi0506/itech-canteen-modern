import React, { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import { TrendingUp, ShoppingBag, DollarSign, Users } from 'lucide-react';

const formatCurrency = (value) => `Rs.${Number(value || 0).toFixed(2)}`;

const formatDayLabel = (dateString) => {
  const parsedDate = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return dateString;
  }
  return parsedDate.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
  });
};

const PieChartCard = ({ data }) => {
  const total = data.reduce((sum, item) => sum + Number(item.revenue || 0), 0);
  const colors = ['#b04a2f', '#d97a47', '#e8b563', '#8a6d3b', '#f2d7a1', '#6d4c41'];

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

    const path = percentage === 0
      ? null
      : `M 50 50 L ${x1} ${y1} A 42 42 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return {
      ...item,
      color: colors[index % colors.length],
      path,
      percentage
    };
  });

  return (
    <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-5">
      <div>
        <h3 className="font-headline font-bold text-sm text-on-surface">Category Revenue Mix</h3>
        <p className="text-xs text-secondary mt-1">Pie chart view of category contribution.</p>
      </div>

      {total > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-center">
          <div className="flex justify-center">
            <svg viewBox="0 0 100 100" className="w-52 h-52 drop-shadow-sm">
              {slices.map((slice) => (
                slice.path ? <path key={slice.name} d={slice.path} fill={slice.color} /> : null
              ))}
              <circle cx="50" cy="50" r="20" fill="white" />
              <text x="50" y="47" textAnchor="middle" className="fill-[#1f2937]" fontSize="7" fontWeight="700">
                Total
              </text>
              <text x="50" y="56" textAnchor="middle" className="fill-[#1f2937]" fontSize="7" fontWeight="700">
                {formatCurrency(total)}
              </text>
            </svg>
          </div>

          <div className="space-y-3">
            {slices.map((slice) => (
              <div key={slice.name} className="flex items-center justify-between gap-4 rounded-xl border border-outline/10 bg-surface p-3">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: slice.color }} />
                  <div>
                    <p className="font-semibold text-on-surface">{slice.name}</p>
                    <p className="text-xs text-secondary">{(slice.percentage * 100).toFixed(1)}% of category revenue</p>
                  </div>
                </div>
                <p className="font-bold text-on-surface">{formatCurrency(slice.revenue)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-secondary">No category sales found yet.</p>
      )}
    </div>
  );
};

const Reports = () => {
  const [dashboard, setDashboard] = useState(null);
  const [trends, setTrends] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [dayWiseSummary, setDayWiseSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoadError('');
        const results = await Promise.allSettled([
          api.get('/reports/dashboard'),
          api.get('/reports/sales-trend'),
          api.get('/reports/top-products'),
          api.get('/reports/top-categories')
        ]);
        const [dashboardRes, trendsRes, productsRes, categoriesRes] = results;

        if (dashboardRes.status === 'fulfilled') setDashboard(dashboardRes.value.data);
        if (trendsRes.status === 'fulfilled') setTrends(trendsRes.value.data || []);
        if (productsRes.status === 'fulfilled') setProducts(productsRes.value.data || []);
        if (categoriesRes.status === 'fulfilled') setCategories(categoriesRes.value.data || []);

        const failedSections = results
          .map((result, index) => ({ result, index }))
          .filter(({ result }) => result.status === 'rejected')
          .map(({ index }) => ['dashboard', 'sales trend', 'top products', 'top categories'][index]);

        if (failedSections.length > 0) {
          setLoadError(`Some analytics feeds could not load: ${failedSections.join(', ')}.`);
        }
      } catch (e) {
        console.error(e);
        setLoadError('Reports could not be loaded right now.');
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  const displayDayWiseSummary = useMemo(() => {
    if (dayWiseSummary.length > 0) {
      return dayWiseSummary;
    }
    return trends.map((trend) => ({
      ...trend,
      label: formatDayLabel(trend.date),
      customers: trend.customers || 0,
    }));
  }, [dayWiseSummary, trends]);

  const bestDay = useMemo(() => {
    if (!displayDayWiseSummary.length) return null;
    return [...displayDayWiseSummary].sort((a, b) => b.revenue - a.revenue)[0];
  }, [displayDayWiseSummary]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 font-body">
      <div>
        <h1 className="font-headline font-bold text-2xl text-on-surface">Reports & Analytics</h1>
        <p className="text-secondary text-sm">Interactive revenue trends, top product performance, and category metrics.</p>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-surface-container-low border border-outline/10 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-outline text-[10px] font-bold uppercase tracking-wider">All-Time Revenue</p>
            <p className="font-headline text-2xl font-black text-on-surface mt-1">{formatCurrency(dashboard?.all_time_revenue)}</p>
          </div>
          <div className="p-3 bg-primary/5 text-primary rounded-full">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline/10 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-outline text-[10px] font-bold uppercase tracking-wider">All-Time Orders</p>
            <p className="font-headline text-2xl font-black text-on-surface mt-1">{dashboard?.all_time_orders ?? 0}</p>
          </div>
          <div className="p-3 bg-primary/5 text-primary rounded-full">
            <ShoppingBag size={20} />
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline/10 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-outline text-[10px] font-bold uppercase tracking-wider">Avg Order Value</p>
            <p className="font-headline text-2xl font-black text-on-surface mt-1">{formatCurrency(dashboard?.avg_order_value)}</p>
          </div>
          <div className="p-3 bg-primary/5 text-primary rounded-full">
            <TrendingUp size={20} />
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline/10 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-outline text-[10px] font-bold uppercase tracking-wider">Month Revenue</p>
            <p className="font-headline text-2xl font-black text-on-surface mt-1">{formatCurrency(dashboard?.month_revenue)}</p>
          </div>
          <div className="p-3 bg-primary/5 text-primary rounded-full">
            <DollarSign size={20} />
          </div>
        </div>
      </div>

      <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-primary" />
          <h3 className="font-headline font-bold text-sm text-on-surface">Statistics Table</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline/10 text-outline text-xs uppercase tracking-wider">
                <th className="py-3 pr-4 font-bold">Date</th>
                <th className="py-3 pr-4 font-bold">Revenue</th>
                <th className="py-3 pr-4 font-bold">Orders</th>
                <th className="py-3 font-bold">Customers</th>
              </tr>
            </thead>
            <tbody>
              {displayDayWiseSummary.map((day) => (
                <tr key={`stats-${day.date}`} className="border-b border-outline/10 text-sm last:border-0">
                  <td className="py-3 pr-4 text-secondary">{day.label || day.date}</td>
                  <td className="py-3 pr-4 font-semibold text-on-surface">{formatCurrency(day.revenue)}</td>
                  <td className="py-3 pr-4 text-secondary">{day.orders}</td>
                  <td className="py-3 text-secondary">{day.customers}</td>
                </tr>
              ))}
              {displayDayWiseSummary.length === 0 && (
                <tr>
                  <td colSpan="4" className="py-4 text-sm text-secondary">No statistical summary available yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4">
          <h3 className="font-headline font-bold text-sm text-on-surface border-b border-outline/5 pb-2">Past 7 Days Sales Trend</h3>
          <div className="space-y-3">
            {trends.map((t) => (
              <div key={t.date} className="flex justify-between items-center text-sm border-b border-outline/5 pb-2 last:border-0 last:pb-0">
                <div>
                  <span className="text-secondary">{t.date}</span>
                  <p className="text-xs text-outline mt-1">{t.customers || 0} customers</p>
                </div>
                <div className="space-x-4">
                  <span className="text-outline text-xs">{t.orders} orders</span>
                  <span className="font-bold text-on-surface">{formatCurrency(t.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4">
          <h3 className="font-headline font-bold text-sm text-on-surface border-b border-outline/5 pb-2">Today Snapshot</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-secondary">Revenue today</span>
              <span className="font-bold text-on-surface">{formatCurrency(dashboard?.today_revenue)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-secondary">Paid orders today</span>
              <span className="font-bold text-on-surface">{dashboard?.today_orders ?? 0}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-secondary">Customers today</span>
              <span className="font-bold text-on-surface">{dashboard?.today_customers ?? 0}</span>
            </div>
            {bestDay && (
              <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 mt-3">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Best day this week</p>
                <p className="font-semibold text-on-surface mt-1">{bestDay.label}</p>
                <p className="text-sm text-secondary mt-1">
                  {formatCurrency(bestDay.revenue)} from {bestDay.orders} orders and {bestDay.customers} customers.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-6">
        <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4">
          <h3 className="font-headline font-bold text-sm text-on-surface border-b border-outline/5 pb-2">Top 5 Best Selling Products</h3>
          <div className="space-y-3">
            {products.map((p, idx) => (
              <div key={p.name} className="flex justify-between items-center text-sm border-b border-outline/5 pb-2 last:border-0 last:pb-0">
                <span className="font-semibold text-on-surface flex items-center gap-2">
                  <span className="text-xs bg-primary/10 text-primary w-5 h-5 flex items-center justify-center rounded-full font-bold">{idx + 1}</span>
                  {p.name}
                </span>
                <div className="space-x-4">
                  <span className="text-outline text-xs">{p.quantity} units</span>
                  <span className="font-bold text-on-surface">{formatCurrency(p.revenue)}</span>
                </div>
              </div>
            ))}
            {products.length === 0 && <p className="text-xs text-outline italic">No order sales found yet.</p>}
          </div>
        </div>

        <PieChartCard data={categories} />
      </div>
    </div>
  );
};

export default Reports;
