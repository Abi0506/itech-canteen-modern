import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { TrendingUp, ShoppingBag, DollarSign, Award } from 'lucide-react';

const Reports = () => {
  const [dashboard, setDashboard] = useState(null);
  const [trends, setTrends] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const [dRes, tRes, pRes, cRes] = await Promise.all([
          api.get('/reports/dashboard'),
          api.get('/reports/sales-trend'),
          api.get('/reports/top-products'),
          api.get('/reports/top-categories')
        ]);
        setDashboard(dRes.data);
        setTrends(tRes.data);
        setProducts(pRes.data);
        setCategories(cRes.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-surface-container-low border border-outline/10 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-outline text-[10px] font-bold uppercase tracking-wider">All-Time Revenue</p>
            <p className="font-headline text-2xl font-black text-on-surface mt-1">Rs.{dashboard?.all_time_revenue.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-primary/5 text-primary rounded-full">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline/10 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-outline text-[10px] font-bold uppercase tracking-wider">All-Time Orders</p>
            <p className="font-headline text-2xl font-black text-on-surface mt-1">{dashboard?.all_time_orders}</p>
          </div>
          <div className="p-3 bg-primary/5 text-primary rounded-full">
            <ShoppingBag size={20} />
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline/10 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-outline text-[10px] font-bold uppercase tracking-wider">Avg Order Value</p>
            <p className="font-headline text-2xl font-black text-on-surface mt-1">Rs.{dashboard?.avg_order_value.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-primary/5 text-primary rounded-full">
            <TrendingUp size={20} />
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline/10 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-outline text-[10px] font-bold uppercase tracking-wider">Month Revenue</p>
            <p className="font-headline text-2xl font-black text-on-surface mt-1">Rs.{dashboard?.month_revenue.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-primary/5 text-primary rounded-full">
            <DollarSign size={20} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sales Trend */}
        <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4">
          <h3 className="font-headline font-bold text-sm text-on-surface border-b border-outline/5 pb-2">Past 7 Days Sales Trend</h3>
          <div className="space-y-3">
            {trends.map((t, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm border-b border-outline/5 pb-2 last:border-0 last:pb-0">
                <span className="text-secondary">{t.date}</span>
                <div className="space-x-4">
                  <span className="text-outline text-xs">{t.orders} orders</span>
                  <span className="font-bold text-on-surface">Rs.{t.revenue.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4">
          <h3 className="font-headline font-bold text-sm text-on-surface border-b border-outline/5 pb-2">Top 5 Best Selling Products</h3>
          <div className="space-y-3">
            {products.map((p, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm border-b border-outline/5 pb-2 last:border-0 last:pb-0">
                <span className="font-semibold text-on-surface flex items-center gap-2">
                  <span className="text-xs bg-primary/10 text-primary w-5 h-5 flex items-center justify-center rounded-full font-bold">{idx+1}</span>
                  {p.name}
                </span>
                <div className="space-x-4">
                  <span className="text-outline text-xs">{p.quantity} units</span>
                  <span className="font-bold text-on-surface">Rs.{p.revenue.toFixed(2)}</span>
                </div>
              </div>
            ))}
            {products.length === 0 && <p className="text-xs text-outline italic">No order sales found yet.</p>}
          </div>
        </div>
      </div>

      {/* Top Categories */}
      <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4 max-w-md">
        <h3 className="font-headline font-bold text-sm text-on-surface border-b border-outline/5 pb-2">Category Revenue Breakdown</h3>
        <div className="space-y-3">
          {categories.map((c, idx) => (
            <div key={idx} className="flex justify-between items-center text-sm">
              <span className="text-secondary">{c.name}</span>
              <span className="font-bold text-on-surface">Rs.{c.revenue.toFixed(2)}</span>
            </div>
          ))}
          {categories.length === 0 && <p className="text-xs text-outline italic">No category sales found yet.</p>}
        </div>
      </div>

    </div>
  );
};

export default Reports;
