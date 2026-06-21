import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api, { getWebSocketUrl } from '../../utils/api';
import { Clock3, ReceiptText, Sparkles } from 'lucide-react';

const CustomerDisplay = () => {
  const { tableId } = useParams();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadDisplay = async () => {
    try {
      const res = await api.get(`/display/tables/${tableId}`);
      setPayload(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDisplay();
    const socket = new WebSocket(getWebSocketUrl('/ws/customer_display'));
    socket.onmessage = () => loadDisplay();
    return () => socket.close();
  }, [tableId]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-secondary">Loading display...</div>;
  }

  const order = payload?.order;

  return (
    <div className="min-h-screen bg-surface p-4 text-on-surface">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-outline/10 bg-surface-container-low p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Customer Display</p>
          <h1 className="mt-2 font-headline text-3xl font-black">Table {payload?.table?.table_number}</h1>
          <p className="mt-1 text-sm text-secondary">
            {payload?.table?.status || 'available'} status is mirrored live from the cashier POS.
          </p>
        </div>

        {!order ? (
          <div className="rounded-3xl border border-outline/10 bg-surface-container-low p-10 text-center">
            <Sparkles className="mx-auto text-primary" size={28} />
            <h2 className="mt-4 font-headline text-2xl font-bold">Waiting for order</h2>
            <p className="mt-2 text-secondary">The cashier will start the bill and order details will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
            <div className="rounded-3xl border border-outline/10 bg-surface-container-low p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Bill #{order.bill_number}</p>
                  <h2 className="font-headline text-2xl font-bold">Order details</h2>
                </div>
                <ReceiptText className="text-primary" size={24} />
              </div>

              <div className="mt-6 space-y-3">
                {Object.entries(order.items || {}).map(([itemKey, item]) => (
                  <div key={itemKey} className="flex items-center justify-between rounded-2xl border border-outline/10 bg-surface-container-lowest px-4 py-3">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-secondary">
                        {item.quantity} x {item.rate}
                      </p>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      {item.status || 'pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 rounded-3xl border border-outline/10 bg-surface-container-low p-6">
              <div className="rounded-2xl bg-primary text-on-primary p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Total</p>
                <p className="mt-2 font-headline text-4xl font-black">₹{Number(order.total_amount || 0).toFixed(2)}</p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-secondary">Subtotal</span>
                  <span className="font-semibold">₹{Number(order.subtotal_amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Tax</span>
                  <span className="font-semibold">₹{Number(order.tax_amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Discount</span>
                  <span className="font-semibold">₹{Number(order.discount_amount || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-outline/10 bg-surface-container-lowest p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-outline">
                  <Clock3 size={12} />
                  Status
                </div>
                <p className="mt-2 text-lg font-bold capitalize">{order.order_status}</p>
                <p className="text-sm text-secondary capitalize">{order.payment_status}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerDisplay;
