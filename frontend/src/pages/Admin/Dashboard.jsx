import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { Users, Landmark, DollarSign, AlertOctagon, X, CalendarDays } from 'lucide-react';

const formatCurrency = (value) => `Rs.${Number(value || 0).toFixed(2)}`;

const StatCard = ({ title, value, icon, note, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full bg-surface-container-low border border-outline/10 p-5 rounded-2xl flex items-center justify-between text-left transition hover:border-primary/20 hover:shadow-sm"
  >
    <div>
      <p className="text-outline text-[10px] font-bold uppercase tracking-wider">{title}</p>
      <p className="font-headline text-3xl font-black text-on-surface mt-1">{value}</p>
      {note && <p className="text-xs text-secondary mt-2">{note}</p>}
    </div>
    <div className="p-3 bg-primary/5 text-primary rounded-full">
      {icon}
    </div>
  </button>
);

const DetailModal = ({ title, subtitle, rows, onClose }) => (
  <div className="fixed inset-0 z-50 bg-black/45 p-4 flex items-center justify-center">
    <div className="w-full max-w-2xl rounded-3xl bg-surface border border-outline/10 shadow-2xl">
      <div className="flex items-start justify-between gap-4 p-6 border-b border-outline/10">
        <div>
          <h3 className="font-headline text-xl font-bold text-on-surface">{title}</h3>
          {subtitle && <p className="text-sm text-secondary mt-1">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full text-secondary hover:bg-surface-container"
          aria-label="Close details"
        >
          <X size={18} />
        </button>
      </div>
      <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto">
        {rows.map((row) => (
          <div key={row.label} className="rounded-2xl border border-outline/10 bg-surface-container-low p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-on-surface">{row.label}</p>
                {row.meta && <p className="text-xs text-secondary mt-1">{row.meta}</p>}
              </div>
              <div className="text-right">
                <p className="font-headline text-lg font-bold text-on-surface">{row.value}</p>
                {row.secondary && <p className="text-xs text-secondary mt-1">{row.secondary}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null);

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

  const dayWiseStats = stats?.day_wise_statistics || [];
  const revenueModalRows = dayWiseStats.map((day) => ({
    label: day.label,
    meta: `${day.orders} paid orders`,
    value: formatCurrency(day.revenue),
    secondary: `${day.customers} active customers`
  }));
  const customerModalRows = dayWiseStats.map((day) => ({
    label: day.label,
    meta: `${day.new_customers} newly registered`,
    value: `${day.customers} active`,
    secondary: `${day.orders} paid orders`
  }));
  const statsModalRows = dayWiseStats.map((day) => ({
    label: day.label,
    meta: `${day.date}`,
    value: `${day.orders} orders`,
    secondary: `${formatCurrency(day.revenue)} • ${day.customers} customers`
  }));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 font-body">
      <div>
        <h1 className="font-headline font-bold text-2xl text-on-surface">Superadmin Dashboard</h1>
        <p className="text-secondary text-sm">Real-time canteen metrics, orders, and table utilization summary.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Active Staff"
          value={stats?.total_staff ?? 0}
          note="Tap to review daily operational snapshot."
          icon={<Users size={20} />}
          onClick={() => setActiveModal('stats')}
        />
        <StatCard
          title="Total Customers"
          value={stats?.total_customers ?? 0}
          note={`${stats?.today_customers_count ?? 0} active customers today`}
          icon={<Users size={20} />}
          onClick={() => setActiveModal('customers')}
        />
        <StatCard
          title="Revenue Today"
          value={formatCurrency(stats?.today_revenue)}
          note={`${stats?.paid_orders_count ?? 0} paid orders today`}
          icon={<DollarSign size={20} />}
          onClick={() => setActiveModal('revenue')}
        />
        <StatCard
          title="Table Occupancy"
          value={stats?.table_occupancy ?? '0/0'}
          note={`${stats?.available_tables_count ?? 0} tables available now`}
          icon={<Landmark size={20} />}
          onClick={() => setActiveModal('stats')}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.9fr] gap-6">
        <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-headline font-bold text-lg text-on-surface">Day-Wise Statistics</h3>
              <p className="text-sm text-secondary">Revenue, customer activity, and paid orders for the last 7 days.</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal('stats')}
              className="text-xs font-semibold text-primary"
            >
              View details
            </button>
          </div>

          <div className="space-y-3">
            {dayWiseStats.map((day) => (
              <div key={day.date} className="rounded-2xl border border-outline/10 bg-surface p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-on-surface">{day.label}</p>
                    <p className="text-xs text-secondary">{day.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-headline text-lg font-bold text-on-surface">{formatCurrency(day.revenue)}</p>
                    <p className="text-xs text-secondary">{day.orders} orders • {day.customers} customers</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl">
            <h3 className="font-headline font-bold text-sm text-on-surface mb-4">Today&apos;s Transactions Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm text-secondary">
                <span>Paid Orders</span>
                <strong className="text-on-surface">{stats?.paid_orders_count ?? 0} orders</strong>
              </div>
              <div className="flex justify-between text-sm text-secondary">
                <span>Active Customers</span>
                <strong className="text-on-surface">{stats?.today_customers_count ?? 0} customers</strong>
              </div>
              <div className="flex justify-between text-sm text-secondary">
                <span>Occupied Tables</span>
                <strong className="text-on-surface">{stats?.occupied_tables_count ?? 0} occupied</strong>
              </div>
              <div className="flex justify-between text-sm text-secondary">
                <span>Available Tables</span>
                <strong className="text-on-surface">{stats?.available_tables_count ?? 0} open</strong>
              </div>
            </div>
          </div>

          <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 space-y-3">
            <div className="flex items-start gap-3">
              <AlertOctagon className="text-primary flex-shrink-0 mt-0.5" size={22} />
              <div>
                <h3 className="font-semibold text-on-surface">Operational Notes</h3>
                <p className="text-sm text-secondary mt-1 leading-relaxed">
                  Use the popup details on the cards to review day-wise revenue and customer movement quickly before switching to the full reports section.
                </p>
              </div>
            </div>
            <div className="rounded-xl bg-surface px-4 py-3 border border-outline/10">
              <div className="flex items-center gap-2 text-primary mb-1">
                <CalendarDays size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">Quick actions</span>
              </div>
              <p className="text-sm text-secondary">
                Table status lives under <strong className="text-on-surface">Table Monitor</strong>, while deeper sales trends and charts are available under <strong className="text-on-surface">Reports &amp; Charts</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {activeModal === 'revenue' && (
        <DetailModal
          title="Day-Wise Revenue"
          subtitle="Paid revenue collected across the last 7 days."
          rows={revenueModalRows}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'customers' && (
        <DetailModal
          title="Customer Activity Details"
          subtitle="Daily active customers and newly registered customers."
          rows={customerModalRows}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'stats' && (
        <DetailModal
          title="Day-Wise Statistics"
          subtitle="Combined revenue, order, and customer totals for the superadmin view."
          rows={statsModalRows}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
