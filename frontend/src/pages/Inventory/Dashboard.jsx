import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Package, AlertTriangle, RefreshCw, BarChart2 } from 'lucide-react';

const Dashboard = () => {
  const [stock, setStock] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sRes, pRes] = await Promise.all([
          api.get('/inventory/stock'),
          api.get('/inventory/products')
        ]);
        setStock(sRes.data);
        setProducts(pRes.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const lowStockItems = stock.filter((s) => Number(s.current_stock) <= Number(s.reorder_level));
  const uniqueItemsCount = products.length;

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
        <h1 className="font-headline font-bold text-2xl text-on-surface">Inventory Dashboard</h1>
        <p className="text-secondary text-sm">Monitor stock level statistics, sku reorder warnings, and perishable expiry tracking.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-surface-container-low border border-outline/10 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-outline text-[10px] font-bold uppercase tracking-wider">Unique Products</p>
            <p className="font-headline text-3xl font-black text-on-surface mt-1">{uniqueItemsCount}</p>
          </div>
          <div className="p-3 bg-primary/5 text-primary rounded-full">
            <Package size={20} />
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline/10 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-outline text-[10px] font-bold uppercase tracking-wider">Low Stock Warnings</p>
            <p className="font-headline text-3xl font-black text-error mt-1">{lowStockItems.length}</p>
          </div>
          <div className="p-3 bg-error-container text-error rounded-full">
            <AlertTriangle size={20} />
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline/10 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-outline text-[10px] font-bold uppercase tracking-wider">Tracking Ledger Items</p>
            <p className="font-headline text-3xl font-black text-on-surface mt-1">{stock.length}</p>
          </div>
          <div className="p-3 bg-primary/5 text-primary rounded-full">
            <BarChart2 size={20} />
          </div>
        </div>
      </div>

      {/* Low Stock Warnings */}
      <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4">
        <div className="flex justify-between items-center border-b border-outline/5 pb-2">
          <h3 className="font-headline font-bold text-sm text-on-surface flex items-center gap-2">
            <AlertTriangle size={18} className="text-error" />
            Low Stock Reorder Alerts
          </h3>
          <span className="text-[10px] bg-error-container text-error font-bold px-2 py-0.5 rounded-full uppercase">Action Required</span>
        </div>

        <div className="space-y-3">
          {lowStockItems.map((item) => {
            const prod = products.find((p) => p.id === item.product_id);
            return (
              <div key={item.id} className="flex justify-between items-center text-sm border-b border-outline/5 pb-2 last:border-0 last:pb-0">
                <div>
                  <span className="font-semibold text-on-surface">{prod ? prod.name : 'Unknown Product'}</span>
                  <p className="text-[10px] text-outline">SKU: {item.sku}</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-error">{Number(item.current_stock)}</span>
                  <span className="text-secondary text-xs"> / {item.unit} (Limit: {Number(item.reorder_level)})</span>
                </div>
              </div>
            );
          })}
          {lowStockItems.length === 0 && (
            <p className="text-xs text-outline italic">All product stocks are at healthy quantities.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
