import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/api';
import { AlertTriangle, CreditCard, Plus, Minus, Search, ShieldAlert, Sparkles, TicketPercent, UserPlus } from 'lucide-react';

const formatMoney = (value) => `₹${Number(value || 0).toFixed(2)}`;

const SelfOrder = () => {
  const { tableId } = useParams();
  const [table, setTable] = useState(null);
  const [session, setSession] = useState(null);
  const [order, setOrder] = useState(null);
  const [menu, setMenu] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [signup, setSignup] = useState({ name: '', phone_no: '', email: '' });
  const [sessionPin, setSessionPin] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [quantityMap, setQuantityMap] = useState({});

  const loadMenu = async () => {
    try {
      const res = await api.get('/self-order/menu', { params: { table_id: tableId } });
      setTable(res.data.table || null);
      setSession(res.data.session || null);
      setOrder(res.data.order || null);
      setMenu(res.data.menu || []);

      if (!selectedCategoryId && res.data.menu?.length > 0) {
        setSelectedCategoryId(res.data.menu[0].id);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not load menu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  const flatItems = useMemo(() => {
    return menu.flatMap((category) =>
      (category.items || []).map((item) => ({
        ...item,
        category_name: category.name,
        category_color: category.color || '#F59E0B',
      })),
    );
  }, [menu]);

  const filteredItems = useMemo(() => {
    const searchValue = search.trim().toLowerCase();
    return flatItems.filter((item) => {
      const matchesCategory = !selectedCategoryId || item.category_id === selectedCategoryId;
      const matchesSearch =
        !searchValue ||
        item.name.toLowerCase().includes(searchValue) ||
        (item.description || '').toLowerCase().includes(searchValue);
      return matchesCategory && matchesSearch;
    });
  }, [flatItems, search, selectedCategoryId]);

  const orderItems = Object.values(order?.items || {});

  const subtotal = orderItems.reduce((sum, item) => sum + Number(item.rate || 0) * Number(item.quantity || 0), 0);

  const startSession = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post(`/self-order/tables/${tableId}/start`, signup);
      setSession(res.data.session || null);
      setOrder(res.data.order || null);
      setMessage(`Session started. Share PIN ${res.data.session?.session_pin} with other devices.`);
      await loadMenu();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not start session.');
    } finally {
      setBusy(false);
    }
  };

  const joinSession = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post(`/self-order/tables/${tableId}/join`, { session_pin: sessionPin });
      setSession(res.data.session || null);
      setOrder(res.data.order || null);
      setMessage(`Joined session ${res.data.session?.session_pin}.`);
      await loadMenu();
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid PIN.');
    } finally {
      setBusy(false);
    }
  };

  const addItem = async (item) => {
    if (!order?.id) {
      setError('Start or join a session first.');
      return;
    }

    const quantity = quantityMap[item.id] || 1;
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/self-order/orders/${order.id}/items`, {
        items: [{ id: item.id, quantity }],
      });
      setOrder(res.data);
      setMessage(`${item.name} added to the bill.`);
      await loadMenu();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not add item.');
    } finally {
      setBusy(false);
    }
  };

  const sendOrder = async () => {
    if (!order?.id) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/self-order/orders/${order.id}/send`);
      setOrder(res.data);
      setMessage('Order sent to the kitchen.');
      await loadMenu();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not send order.');
    } finally {
      setBusy(false);
    }
  };

  const applyCoupon = async () => {
    if (!order?.id || !couponCode.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/self-order/orders/${order.id}/coupon`, { code: couponCode.trim() });
      setOrder(res.data);
      setMessage('Coupon applied.');
      await loadMenu();
    } catch (err) {
      setError(err.response?.data?.detail || 'Coupon could not be applied.');
    } finally {
      setBusy(false);
    }
  };

  const payBill = async () => {
    if (!order?.id) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/self-order/orders/${order.id}/pay`, { payment_method: paymentMethod });
      setOrder(res.data);
      setMessage(`Paid successfully using ${paymentMethod}.`);
      await loadMenu();
    } catch (err) {
      setError(err.response?.data?.detail || 'Payment failed.');
    } finally {
      setBusy(false);
    }
  };

  const activeCategory = menu.find((category) => category.id === selectedCategoryId);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-secondary">
        Loading self-order menu...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface p-4 text-on-surface md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-outline/10 bg-surface-container-low p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Customer Self-Order</p>
              <h1 className="mt-2 font-headline text-3xl font-black">Table {table?.table_number || tableId}</h1>
              <p className="mt-2 max-w-2xl text-sm text-secondary">
                Scan the QR, view the live menu, and place orders from your table. Cash payment is not available for self-ordering.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-outline/10 bg-surface-container-lowest px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Table status</p>
                <p className="mt-1 font-semibold capitalize">{table?.status || 'available'}</p>
              </div>
              <div className="rounded-2xl border border-outline/10 bg-surface-container-lowest px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Session</p>
                <p className="mt-1 font-semibold">{session?.session_pin || 'No active session'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 shrink-0" size={18} />
            <div>
              <p className="font-bold">Important payment notice</p>
              <p>Self-ordering supports UPI and card only. If you want to pay cash, please ask the cashier to place the order.</p>
            </div>
          </div>
        </div>

        {message && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-error/10 bg-error-container/20 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        {!order ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <form onSubmit={startSession} className="rounded-3xl border border-outline/10 bg-surface-container-low p-6">
              <div className="flex items-center gap-2">
                <UserPlus className="text-primary" size={18} />
                <h2 className="font-headline text-xl font-bold">Start new table session</h2>
              </div>
              <div className="mt-4 grid gap-4">
                <label className="grid gap-2 text-sm">
                  <span className="font-semibold">Name</span>
                  <input
                    type="text"
                    required
                    value={signup.name}
                    onChange={(event) => setSignup((prev) => ({ ...prev, name: event.target.value }))}
                    className="rounded-2xl border border-outline/10 bg-surface-container-lowest px-4 py-3 outline-none focus:border-primary/30"
                    placeholder="Guest name"
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-semibold">Phone number</span>
                  <input
                    type="tel"
                    required
                    value={signup.phone_no}
                    onChange={(event) => setSignup((prev) => ({ ...prev, phone_no: event.target.value }))}
                    className="rounded-2xl border border-outline/10 bg-surface-container-lowest px-4 py-3 outline-none focus:border-primary/30"
                    placeholder="Mobile number"
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-semibold">Email (optional)</span>
                  <input
                    type="email"
                    value={signup.email}
                    onChange={(event) => setSignup((prev) => ({ ...prev, email: event.target.value }))}
                    className="rounded-2xl border border-outline/10 bg-surface-container-lowest px-4 py-3 outline-none focus:border-primary/30"
                    placeholder="Email address"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-bold text-on-primary disabled:opacity-50"
                >
                  <Sparkles size={16} />
                  Start ordering
                </button>
              </div>
            </form>

            <form onSubmit={joinSession} className="rounded-3xl border border-outline/10 bg-surface-container-low p-6">
              <div className="flex items-center gap-2">
                <CreditCard className="text-primary" size={18} />
                <h2 className="font-headline text-xl font-bold">Join existing session</h2>
              </div>
              <p className="mt-2 text-sm text-secondary">
                Family members can join the same table bill using the 4-digit PIN shared by the first device.
              </p>
              <div className="mt-4 grid gap-4">
                <label className="grid gap-2 text-sm">
                  <span className="font-semibold">4-digit PIN</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={sessionPin}
                    onChange={(event) => setSessionPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="rounded-2xl border border-outline/10 bg-surface-container-lowest px-4 py-3 tracking-[0.4em] outline-none focus:border-primary/30"
                    placeholder="0000"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy || sessionPin.length !== 4}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-outline/10 bg-surface-container-high px-4 py-3 font-bold text-secondary disabled:opacity-50"
                >
                  Join session
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-3xl border border-outline/10 bg-surface-container-low p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Menu</p>
                  <h2 className="font-headline text-2xl font-bold">{activeCategory?.name || 'All items'}</h2>
                </div>
                <div className="rounded-2xl border border-outline/10 bg-surface-container-lowest px-4 py-2 text-sm font-semibold">
                  PIN {session?.session_pin}
                </div>
              </div>

              <div className="mt-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" size={16} />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search food or drink"
                  className="w-full rounded-2xl border border-outline/10 bg-surface-container-lowest py-3 pl-9 pr-4 text-sm outline-none focus:border-primary/30"
                />
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {menu.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(category.id)}
                    className="whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold text-white"
                    style={{
                      backgroundColor: selectedCategoryId === category.id ? category.color : `${category.color}CC`,
                    }}
                  >
                    {category.name}
                  </button>
                ))}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {filteredItems.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-outline/10 bg-surface-container-lowest p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-xs text-secondary">{item.category_name}</p>
                      </div>
                      <span className="font-bold text-primary">{formatMoney(item.price)}</span>
                    </div>
                    <p className="mt-2 text-xs text-secondary line-clamp-2">{item.description}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 rounded-full border border-outline/10 bg-surface-container-high px-2 py-1">
                        <button
                          type="button"
                          onClick={() =>
                            setQuantityMap((prev) => ({
                              ...prev,
                              [item.id]: Math.max(1, (prev[item.id] || 1) - 1),
                            }))
                          }
                          className="rounded-full p-1 text-secondary hover:text-primary"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="min-w-6 text-center text-sm font-bold">{quantityMap[item.id] || 1}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setQuantityMap((prev) => ({
                              ...prev,
                              [item.id]: (prev[item.id] || 1) + 1,
                            }))
                          }
                          className="rounded-full p-1 text-secondary hover:text-primary"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => addItem(item)}
                        disabled={busy || item.quantity_available <= 0}
                        className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-on-primary disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <aside className="space-y-4 rounded-3xl border border-outline/10 bg-surface-container-low p-5">
              <div className="rounded-2xl border border-outline/10 bg-surface-container-lowest p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Live bill</p>
                <h3 className="mt-1 font-headline text-2xl font-bold">{order?.bill_number || 'Draft bill'}</h3>
                <p className="mt-1 text-sm text-secondary">
                  Orders stay open until payment is completed, so the table can keep adding items.
                </p>
              </div>

              <div className="space-y-3">
                {orderItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-outline/20 px-4 py-8 text-center text-sm text-secondary">
                    No items added yet.
                  </div>
                ) : (
                  orderItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-2xl border border-outline/10 bg-surface-container-lowest px-4 py-3">
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-xs text-secondary">
                          {item.quantity} x {formatMoney(item.rate)}
                        </p>
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">
                        {item.status || 'pending'}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="rounded-2xl border border-outline/10 bg-surface-container-lowest p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-secondary">Subtotal</span>
                  <span className="font-semibold">{formatMoney(order?.subtotal_amount || subtotal)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-secondary">Tax</span>
                  <span className="font-semibold">{formatMoney(order?.tax_amount || 0)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-secondary">Discount</span>
                  <span className="font-semibold">{formatMoney(order?.discount_amount || 0)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-outline/10 pt-3">
                  <span className="font-bold">Total</span>
                  <span className="font-headline text-2xl font-black text-primary">
                    {formatMoney(order?.total_amount || subtotal)}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-outline/10 bg-surface-container-lowest p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Coupon</p>
                    <p className="text-sm text-secondary">Apply a code before paying.</p>
                  </div>
                  <TicketPercent className="text-primary" size={18} />
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(event) => setCouponCode(event.target.value)}
                    placeholder="Coupon code"
                    className="flex-1 rounded-2xl border border-outline/10 bg-surface-container-low px-4 py-3 text-sm outline-none focus:border-primary/30"
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={busy || !couponCode.trim()}
                    className="rounded-2xl bg-surface-container-high px-4 py-3 text-sm font-bold text-secondary disabled:opacity-50"
                  >
                    Apply
                  </button>
                </div>
                {order?.coupon_code && (
                  <p className="mt-2 text-xs font-semibold text-emerald-700">
                    Coupon {order.coupon_code} applied.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-outline/10 bg-surface-container-lowest p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Payment method</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {['upi', 'card'].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`rounded-2xl border px-4 py-3 text-sm font-bold capitalize transition-colors ${
                        paymentMethod === method
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-outline/10 bg-surface-container-high text-secondary'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={payBill}
                  disabled={busy || !order?.id}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-bold text-on-primary disabled:opacity-50"
                >
                  <CreditCard size={16} />
                  Pay {formatMoney(order?.total_amount || subtotal)}
                </button>
              </div>

              <div className="rounded-2xl border border-outline/10 bg-surface-container-lowest p-4 text-xs text-secondary">
                <AlertTriangle className="mr-2 inline-block text-amber-600" size={14} />
                Current PIN: <span className="font-bold text-on-surface">{session?.session_pin || '—'}</span>. Share this PIN with other devices to join the same order.
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};

export default SelfOrder;
