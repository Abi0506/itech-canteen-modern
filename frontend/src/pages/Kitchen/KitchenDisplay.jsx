import React, { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import { CheckCircle2, Clock3, PlayCircle, RefreshCw, Table2 } from 'lucide-react';

const KitchenDisplay = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const loadOrders = async () => {
    try {
      const res = await api.get('/kds/orders');
      setOrders(res.data || []);
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Failed to load kitchen tickets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    const socket = new WebSocket(`ws://localhost:8000/ws/kds`);
    socket.onmessage = () => loadOrders();
    socket.onclose = () => {};
    return () => socket.close();
  }, []);

  const groupedOrders = useMemo(() => {
    const groups = {};
    orders.forEach((order) => {
      const key = order.table_id || 'unassigned';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(order);
    });
    return groups;
  }, [orders]);

  const markItem = async (orderId, foodItemId, action) => {
    try {
      await api.post(`/kds/orders/${orderId}/items/${foodItemId}/${action}`);
      await loadOrders();
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Failed to update item.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6 font-body">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Kitchen Display</p>
          <h1 className="font-headline text-2xl font-bold text-on-surface">Live order tickets</h1>
          <p className="text-sm text-secondary">Items move from to cook to preparing to completed in real time.</p>
        </div>
        <button
          type="button"
          onClick={loadOrders}
          className="inline-flex items-center gap-2 rounded-2xl border border-outline/10 bg-surface-container-low px-4 py-3 text-sm font-bold text-on-surface"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {message && (
        <div className="rounded-xl border border-error/10 bg-error-container/20 px-4 py-3 text-sm text-error">
          {message}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(groupedOrders).map(([tableId, tableOrders]) => (
          <div key={tableId} className="rounded-3xl border border-outline/10 bg-surface-container-low p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Table</p>
                <h2 className="font-headline text-xl font-bold text-on-surface">
                  {tableId === 'unassigned' ? 'Unassigned' : `T${tableId}`}
                </h2>
              </div>
              <Table2 className="text-primary" size={18} />
            </div>

            <div className="space-y-4">
              {tableOrders.map((order) => (
                <div key={order.id} className="rounded-2xl border border-outline/10 bg-surface-container-lowest p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Bill #{order.bill_number}</p>
                      <p className="text-xs text-secondary capitalize">{order.kitchen_status}</p>
                    </div>
                    <Clock3 size={16} className="text-outline" />
                  </div>

                  <div className="space-y-2">
                    {Object.entries(order.items || {}).map(([itemKey, item]) => (
                      <div key={itemKey} className="rounded-xl border border-outline/10 bg-surface-container-low p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-on-surface">{item.name}</p>
                            <p className="text-[10px] text-outline">{item.quantity} x {item.rate}</p>
                          </div>
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                            {item.status || 'pending'}
                          </span>
                        </div>

                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => markItem(order.id, item.id || Number(itemKey), 'start')}
                            className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-surface-container-high px-3 py-2 text-xs font-bold text-secondary"
                          >
                            <PlayCircle size={14} />
                            Preparing
                          </button>
                          <button
                            type="button"
                            onClick={() => markItem(order.id, item.id || Number(itemKey), 'complete')}
                            className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-700"
                          >
                            <CheckCircle2 size={14} />
                            Done
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KitchenDisplay;
