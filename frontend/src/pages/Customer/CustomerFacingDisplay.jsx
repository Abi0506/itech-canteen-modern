import React, { useState, useEffect } from 'react';
import api, { getWebSocketUrl } from '../../utils/api';
import { ShoppingCart, Sparkles, CheckCircle, User } from 'lucide-react';

const CustomerFacingDisplay = () => {
  const [activeTableId, setActiveTableId] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [liveData, setLiveData] = useState({
    cart: [],
    order_items: [],
    customer: null,
    totals: { subtotal: 0, tax: 0, total: 0, balance_due: 0 }
  });

  const activeTableIdRef = React.useRef(activeTableId);

  // Sync ref whenever state changes (just in case, though we also update it directly)
  useEffect(() => {
    activeTableIdRef.current = activeTableId;
  }, [activeTableId]);

  // Fetch initial data when table changes (fallback in case sync hasn't arrived)
  useEffect(() => {
    if (!activeTableId) {
      setLiveData({ cart: [], order_items: [], customer: null, totals: { subtotal: 0, tax: 0, total: 0, balance_due: 0 } });
      return;
    }

    const fetchOrder = async () => {
      try {
        const res = await api.get(`/cfd/tables/${activeTableId}/order`);
        // We only use this as fallback if no sync data is there.
        // It's usually overridden instantly by cfd_sync.
        setLiveData(prev => ({
          ...prev,
          order_items: res.data.items.map((i, idx) => ({
            id: idx,
            name: i.product?.name || i.name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            line_total: i.unit_price * i.quantity,
          })),
          customer: res.data.customer,
          totals: {
            subtotal: res.data.subtotal,
            tax: res.data.tax_total,
            total: res.data.total,
            balance_due: res.data.total
          }
        }));
      } catch (err) {
        // Not a problem if it's 404 (empty table)
      }
    };

    fetchOrder();
  }, [activeTableId]);

  // Persistent WebSocket connection
  useEffect(() => {
    const wsUrl = getWebSocketUrl(`/ws/cfd_client_${Date.now()}`);
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.event === 'cfd_table_changed') {
          setActiveTableId(data.table_id);
          activeTableIdRef.current = data.table_id;
          if (data.table_id === null) {
            setPaymentSuccess(false);
          }
        }

        if (data.event === 'cfd_sync' && data.data.table_id === activeTableIdRef.current) {
          setLiveData({
            cart: data.data.cart || [],
            order_items: data.data.order_items || [],
            customer: data.data.customer || null,
            totals: data.data.totals || { subtotal: 0, tax: 0, total: 0, balance_due: 0 }
          });
        }

        if (data.event === 'payment_completed' && data.table_id === activeTableIdRef.current) {
          setPaymentSuccess(true);
          setTimeout(() => {
            setPaymentSuccess(false);
            setActiveTableId(null);
            activeTableIdRef.current = null;
            setLiveData({ cart: [], order_items: [], customer: null, totals: { subtotal: 0, tax: 0, total: 0, balance_due: 0 } });
          }, 5000);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    return () => socket.close();
  }, []); // Empty dependency array = connect only once!

  if (paymentSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-50 text-emerald-900 font-body">
        <div className="text-center space-y-6">
          <CheckCircle size={120} className="mx-auto text-emerald-500 animate-bounce" />
          <h1 className="font-headline text-5xl font-black tracking-tight">Payment Successful!</h1>
          <p className="text-2xl font-semibold opacity-80">Thank you for visiting Cafe Odoo.</p>
        </div>
      </div>
    );
  }

  if (!activeTableId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(180deg,#fffaf4_0%,#fffdf8_100%)] font-body relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 pattern-dots" />
        <div className="relative text-center space-y-6 max-w-2xl px-6">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 text-primary mb-4">
            <Sparkles size={48} />
          </div>
          <h1 className="font-headline text-6xl font-black tracking-tight text-on-surface">Welcome to Cafe Odoo</h1>
          <p className="text-2xl text-secondary">We'll be right with you!</p>
        </div>
      </div>
    );
  }

  const { cart, order_items, customer, totals } = liveData;

  return (
    <div className="min-h-screen flex bg-surface-container font-body">
      {/* Left side: Beautiful graphic or promotion */}
      <div className="flex-1 bg-primary text-on-primary p-12 flex flex-col justify-between hidden lg:flex">
        <div>
          <h2 className="font-headline text-4xl font-bold opacity-90">Enjoy your meal!</h2>
          <p className="mt-4 text-xl opacity-75">Your order details are displayed on the right.</p>
        </div>
        <div className="text-6xl font-black tracking-tighter opacity-10">Cafe Odoo</div>
      </div>

      {/* Right side: Bill Display */}
      <div className="w-full lg:w-[500px] bg-surface p-6 flex flex-col justify-between h-screen shadow-2xl overflow-y-auto">
        <div className="space-y-6 flex-1">
          {/* Customer Section */}
          <div className="rounded-2xl border border-outline/10 bg-surface-container-low p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <User size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">Customer</p>
              {customer ? (
                <div>
                  <p className="font-bold text-on-surface text-lg">{customer.name}</p>
                  <p className="text-xs text-secondary">{customer.mobile_number}</p>
                </div>
              ) : (
                <p className="font-bold text-on-surface text-lg">Guest</p>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center border-b border-outline/10 pb-4">
            <h3 className="font-headline font-bold text-2xl flex items-center gap-3 text-on-surface">
              <ShoppingCart size={24} className="text-primary" />
              Your Order
            </h3>
          </div>

          {order_items.length === 0 && cart.length === 0 && (
            <div className="py-12 text-center text-outline">
              <p className="text-lg">Waiting for items...</p>
            </div>
          )}

          <div className="space-y-4">
            {order_items.map((item, idx) => (
              <div key={`order-${idx}`} className="flex justify-between items-start gap-4 py-3 border-b border-outline/5 last:border-0 opacity-80">
                <div>
                  <span className="font-bold text-lg text-on-surface">{item.name}</span>
                  <p className="text-sm text-secondary">
                    Rs.{Number(item.unit_price).toFixed(2)} each (Sent to Kitchen)
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-lg text-on-surface">x{Number(item.quantity)}</span>
                  <p className="text-sm font-semibold text-secondary mt-1">Rs.{Number(item.line_total).toFixed(2)}</p>
                </div>
              </div>
            ))}

            {cart.map((item, idx) => (
              <div key={`cart-${idx}`} className="flex justify-between items-start gap-4 py-3 border-b border-outline/5 last:border-0 bg-primary/5 rounded-xl px-2">
                <div>
                  <span className="font-bold text-lg text-on-surface">{item.name}</span>
                  <p className="text-sm text-primary">
                    Rs.{Number(item.price).toFixed(2)} each (New)
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-lg text-on-surface text-primary">x{Number(item.quantity)}</span>
                  <p className="text-sm font-bold text-primary mt-1">Rs.{(Number(item.price) * Number(item.quantity)).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 rounded-3xl border-2 border-outline/10 bg-surface-container-lowest p-6 space-y-3">
          <div className="flex justify-between text-secondary text-lg">
            <span>Subtotal</span>
            <span>Rs.{Number(totals.subtotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-secondary text-lg">
            <span>Tax 5%</span>
            <span>Rs.{Number(totals.tax).toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t-2 border-outline/10 pt-4 text-3xl font-black text-on-surface mt-2">
            <span>Total</span>
            <span className="text-primary">Rs.{Number(totals.balance_due).toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerFacingDisplay;

