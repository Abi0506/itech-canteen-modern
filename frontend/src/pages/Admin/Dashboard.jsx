import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Users, LayoutGrid, DollarSign, Activity, AlertOctagon } from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/admin/dashboard-stats');
        setStats(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
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
        <h1 className="font-headline font-bold text-2xl text-on-surface">Superadmin Dashboard</h1>
        <p className="text-secondary text-sm">System statistics and access overview panel.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="bg-surface-container-low border border-outline/10 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-outline text-[10px] font-bold uppercase tracking-wider">Total Customers</p>
            <p className="font-headline text-3xl font-black text-on-surface mt-1">{stats?.total_users}</p>
          </div>
          <div className="p-3 bg-primary/5 text-primary rounded-full">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline/10 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-outline text-[10px] font-bold uppercase tracking-wider">Active Food Items</p>
            <p className="font-headline text-3xl font-black text-on-surface mt-1">{stats?.active_items}</p>
          </div>
          <div className="p-3 bg-primary/5 text-primary rounded-full">
            <LayoutGrid size={20} />
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline/10 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-outline text-[10px] font-bold uppercase tracking-wider">Revenue Today</p>
            <p className="font-headline text-3xl font-black text-on-surface mt-1">₹{stats?.today_revenue.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-primary/5 text-primary rounded-full">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline/10 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-outline text-[10px] font-bold uppercase tracking-wider">System Mode</p>
            <p className="font-headline text-xl font-black text-on-surface mt-1 uppercase text-emerald-600">
              {stats?.sales_mode}
            </p>
          </div>
          <div className="p-3 bg-primary/5 text-primary rounded-full">
            <Activity size={20} />
          </div>
        </div>

      </div>

      {/* Comparisons pane */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-surface-container-low border border-outline/10 p-6 rounded-2xl">
        <div>
          <h3 className="font-headline font-bold text-sm text-on-surface mb-2">Today vs Yesterday Revenue</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-xs text-secondary">
              <span>Today:</span>
              <strong className="text-on-surface">₹{stats?.today_revenue.toFixed(2)}</strong>
            </div>
            <div className="flex justify-between text-xs text-secondary">
              <span>Yesterday:</span>
              <strong className="text-on-surface">₹{stats?.yesterday_revenue.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
          <AlertOctagon className="text-primary flex-shrink-0" size={24} />
          <p className="text-xs text-secondary leading-relaxed">
            Keep access controls and operational settings aligned with the restaurant schedule.
          </p>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
