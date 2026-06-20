import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Layers, Coffee, Landmark, User, Clock, CheckCircle } from 'lucide-react';

const TableMonitor = () => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/admin/tables/status');
      setTables(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll status every 8 seconds
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 font-body">
      <div>
        <h1 className="font-headline font-bold text-2xl text-on-surface">Live Table Monitor</h1>
        <p className="text-secondary text-sm">Real-time layout monitoring including active cart values, waiter allocations, and kitchen prep status.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {tables.map((t) => {
          let statusColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
          if (t.status === 'occupied') {
            statusColor = 'bg-primary/5 text-primary border-primary/20';
          } else if (t.status === 'reserved') {
            statusColor = 'bg-amber-50 text-amber-800 border-amber-200';
          }

          return (
            <div
              key={t.table_id}
              className={`p-5 rounded-2xl border-2 bg-surface-container-low transition-all shadow-sm flex flex-col justify-between ${
                t.status === 'occupied' ? 'border-primary/25 shadow-md scale-[1.02]' : 'border-transparent'
              }`}
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-headline font-bold text-lg text-on-surface">Table {t.table_number}</h3>
                    <p className="text-[10px] text-outline uppercase font-bold tracking-wider">{t.seats} Seats Available</p>
                  </div>
                  <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full border ${statusColor}`}>
                    {t.status}
                  </span>
                </div>

                {/* Serving Waiter */}
                {t.waiter_name ? (
                  <div className="flex items-center gap-2 text-xs text-secondary bg-surface-container px-3 py-1.5 rounded-lg border border-outline/5">
                    <User size={14} className="text-primary" />
                    <span>Server: <strong className="text-on-surface">{t.waiter_name}</strong></span>
                  </div>
                ) : (
                  <div className="text-[10px] text-outline italic">No waiter assigned currently</div>
                )}

                {/* Active Order Details */}
                {t.active_order ? (
                  <div className="space-y-2 border-t border-outline/5 pt-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-secondary">Order Number:</span>
                      <span className="font-semibold text-on-surface">{t.active_order.order_number}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-secondary">Total Items:</span>
                      <span className="font-semibold text-on-surface">{t.active_order.items_count} items</span>
                    </div>
                    <div className="flex justify-between text-xs items-center">
                      <span className="text-secondary flex items-center gap-1">
                        <Clock size={12} className="text-primary animate-pulse" />
                        Cooking Prep:
                      </span>
                      <span className="font-semibold text-on-surface bg-primary-fixed/35 px-2 py-0.5 rounded text-[10px]">
                        {t.active_order.cooking_progress} completed
                      </span>
                    </div>
                  </div>
                ) : (
                  t.status === 'occupied' && (
                    <p className="text-[10px] text-secondary italic">Table marked occupied. Placing order...</p>
                  )
                )}
              </div>

              {/* Bottom Actions or Status Icon */}
              <div className="pt-4 border-t border-outline/5 mt-4 flex items-center justify-between">
                <span className="text-[10px] text-secondary">
                  {t.status === 'available' ? 'Ready for Guest' : 'Active Guest Session'}
                </span>
                {t.status === 'available' ? (
                  <CheckCircle size={18} className="text-emerald-500" />
                ) : (
                  <Coffee size={18} className="text-primary animate-bounce" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TableMonitor;
