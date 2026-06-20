import React, { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import { Search, Plus, Minus, Table2, Send, CreditCard, CheckCircle, Clock3, MapPinned, TicketPercent } from 'lucide-react';
import { groupOrderItems } from '../../utils/orderItems';

const Billing = () => {
  const [floors, setFloors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [activeFloorId, setActiveFloorId] = useState(null);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [activeTable, setActiveTable] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [billSummary, setBillSummary] = useState(null);
  const [couponCode, setCouponCode] = useState('');
  const [redeemPoints, setRedeemPoints] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const [floorsRes, categoriesRes] = await Promise.all([
        api.get('/cashier/floors'),
        api.get('/users/categories'),
      ]);

      setFloors(floorsRes.data || []);
      setCategories(categoriesRes.data || []);

      if (!activeFloorId && floorsRes.data?.length > 0) {
        setActiveFloorId(floorsRes.data[0].id);
      }
      if (!activeCategoryId && categoriesRes.data?.length > 0) {
        setActiveCategoryId(categoriesRes.data[0].id);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load cashier POS data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadBillSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrder?.id, couponCode, redeemPoints]);

  const flatItems = useMemo(() => {
    const items = [];
    categories.forEach((category) => {
      category.items?.forEach((item) => {
        items.push({
          ...item,
          category_id: category.id,
          category_name: category.name,
          category_color: category.color || '#F59E0B',
        });
      });
    });
    return items;
  }, [categories]);

  const visibleTables = useMemo(() => {
    const floor = floors.find((entry) => entry.id === activeFloorId);
    return floor?.tables || [];
  }, [floors, activeFloorId]);

  const visibleCategories = categories;

  const filteredItems = useMemo(() => {
    return flatItems.filter((item) => {
      const categoryMatch = !activeCategoryId || item.category_id === activeCategoryId;
      const searchValue = search.trim().toLowerCase();
      const searchMatch =
        !searchValue ||
        item.name.toLowerCase().includes(searchValue) ||
        (item.description || '').toLowerCase().includes(searchValue);
      return categoryMatch && searchMatch;
    });
  }, [flatItems, activeCategoryId, search]);

  const currentItems = useMemo(() => {
    const items = activeOrder?.items ? Object.values(activeOrder.items) : [];
    return groupOrderItems(items);
  }, [activeOrder]);

  const subtotal = currentItems.reduce((sum, item) => {
    const price = Number(item.unit_price || item.rate || item.price || 0);
    return sum + (price * Number(item.quantity || 0));
  }, 0);

  const loadBillSummary = async (orderId = activeOrder?.id, coupon = couponCode, points = redeemPoints) => {
    if (!orderId) {
      setBillSummary(null);
      return;
    }

    try {
      const res = await api.get(`/cashier/orders/${orderId}/bill-summary`, {
        params: {
          coupon_code: coupon || undefined,
          redeem_points: points ? Number(points) : 0,
        },
      });
      setBillSummary(res.data);
    } catch (err) {
      setBillSummary(null);
    }
  };

  const openTable = async (table) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const openRes = await api.post(`/cashier/tables/${table.id}/open`);
      const orderRes = await api.post(`/cashier/tables/${table.id}/order`);
      setActiveTable({ ...table, session: openRes.data.session });
      setActiveOrder(orderRes.data);
      setMessage(`Table ${table.table_number} is open.`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to open table.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddItem = async (item) => {
    if (!activeOrder?.id) {
      setError('Select a table first.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/cashier/orders/${activeOrder.id}/items`, {
        items: [{ id: item.id, quantity: 1 }],
      });
      setActiveOrder(res.data);
      setMessage(`${item.name} added to the bill.`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not add item.');
    } finally {
      setBusy(false);
    }
  };

  const sendToKitchen = async () => {
    if (!activeOrder?.id) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/cashier/orders/${activeOrder.id}/send-to-kitchen`);
      setActiveOrder(res.data);
      setMessage('Order sent to kitchen.');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not send order to kitchen.');
    } finally {
      setBusy(false);
    }
  };

  const finishPayment = async (paymentMethod) => {
    if (!activeOrder?.id) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/cashier/orders/${activeOrder.id}/payment?payment_method=${paymentMethod}`);
      setActiveOrder(res.data);
      setMessage(`Payment completed with ${paymentMethod}.`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not complete payment.');
    } finally {
      setBusy(false);
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Cashier POS</p>
          <h1 className="font-headline text-2xl font-bold text-on-surface">Table-first order terminal</h1>
          <p className="text-sm text-secondary">Select a table, build the bill, send to kitchen, and complete payment.</p>
        </div>
        <div className="rounded-2xl border border-outline/10 bg-surface-container-low px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Current table</p>
          <p className="font-headline text-lg font-black text-on-surface">
            {activeTable ? `Table ${activeTable.table_number}` : 'None selected'}
          </p>
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-error/10 bg-error-container/20 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.2fr_0.95fr]">
        <section className="rounded-3xl border border-outline/10 bg-surface-container-low p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Floors</p>
              <h2 className="font-headline text-lg font-bold text-on-surface">Table map</h2>
            </div>
            <MapPinned className="text-primary" size={18} />
          </div>

          <div className="mb-4 flex gap-2 overflow-x-auto">
            {floors.map((floor) => (
              <button
                key={floor.id}
                type="button"
                onClick={() => setActiveFloorId(floor.id)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                  activeFloorId === floor.id
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-secondary hover:text-primary'
                }`}
              >
                {floor.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {visibleTables.map((table) => (
              <button
                key={table.id}
                type="button"
                onClick={() => openTable(table)}
                disabled={busy}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  activeTable?.id === table.id
                    ? 'border-primary bg-primary/5'
                    : table.status === 'occupied'
                      ? 'border-amber-400/40 bg-amber-500/10'
                      : table.status === 'reserved'
                        ? 'border-blue-400/40 bg-blue-500/10'
                        : 'border-outline/10 bg-surface-container-lowest hover:border-primary/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-headline text-lg font-bold text-on-surface">T{table.table_number}</p>
                  <Table2 size={16} className="text-primary" />
                </div>
                <p className="text-[10px] uppercase tracking-wider text-outline">{table.seats} seats</p>
                <p className="mt-2 text-xs font-semibold capitalize text-secondary">
                  {table.status}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-outline/10 bg-surface-container-low p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Menu</p>
              <h2 className="font-headline text-lg font-bold text-on-surface">Search and add items</h2>
            </div>
            <Search className="text-primary" size={18} />
          </div>

          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" size={16} />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search menu item"
              className="w-full rounded-2xl border border-outline/10 bg-surface-container-lowest py-3 pl-9 pr-4 text-sm outline-none focus:border-primary/30"
            />
          </div>

          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {visibleCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategoryId(category.id)}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
                  activeCategoryId === category.id
                    ? 'text-white'
                    : 'bg-surface-container-high text-secondary hover:text-primary'
                }`}
                style={activeCategoryId === category.id ? { backgroundColor: category.color } : {}}
              >
                {category.name}
              </button>
            ))}
          </div>

          <div className="grid max-h-[620px] grid-cols-2 gap-3 overflow-y-auto pr-1 md:grid-cols-3">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleAddItem(item)}
                disabled={busy || item.quantity_available <= 0}
                className="rounded-2xl border border-outline/10 bg-surface-container-lowest p-3 text-left transition-all hover:border-primary/30 disabled:opacity-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-on-surface line-clamp-1">{item.name}</p>
                    <p className="text-[10px] uppercase tracking-wider text-outline">{item.category_name}</p>
                  </div>
                  <span className="text-sm font-bold text-primary">₹{Number(item.price).toFixed(2)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] text-outline">
                  <span>{item.quantity_available} left</span>
                  <span>{item.unit_of_measure}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-outline/10 bg-surface-container-low p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Order</p>
              <h2 className="font-headline text-lg font-bold text-on-surface">Cart and payment</h2>
            </div>
            <Clock3 className="text-primary" size={18} />
          </div>

          <div className="space-y-3 border-b border-outline/10 pb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-outline">Bill</span>
              <span className="font-bold text-on-surface">
                {activeOrder?.bill_number ? `#${activeOrder.bill_number}` : 'Not created'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-outline">Status</span>
              <span className="font-bold capitalize text-on-surface">{activeOrder?.order_status || 'draft'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-outline">Kitchen</span>
              <span className="font-bold capitalize text-on-surface">{activeOrder?.kitchen_status || 'to_cook'}</span>
            </div>
          </div>

          <div className="max-h-[360px] space-y-3 overflow-y-auto py-4">
            {currentItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-outline">No items on this table yet.</p>
            ) : (
              currentItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-outline/10 bg-surface-container-lowest p-3">
                  <div>
                    <p className="font-semibold text-on-surface">{item.name}</p>
                    <p className="text-[10px] text-outline">
                      {item.quantity} x ₹{Number(item.unit_price || item.rate || item.price || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" className="rounded-full bg-surface-container-high p-1 text-secondary">
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center text-sm font-bold text-on-surface">{item.quantity}</span>
                    <button type="button" className="rounded-full bg-surface-container-high p-1 text-secondary">
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2 border-t border-outline/10 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-outline">Subtotal</span>
              <span className="font-bold text-on-surface">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-outline">Discount</span>
              <span className="font-bold text-on-surface">₹{Number(activeOrder?.discount_amount || 0).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-outline">Tax</span>
              <span className="font-bold text-on-surface">₹{Number(activeOrder?.tax_amount || 0).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-outline/10 pt-2">
              <span className="font-bold text-on-surface">Total</span>
              <span className="font-headline text-xl font-black text-primary">₹{Number(activeOrder?.total_amount || subtotal).toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={sendToKitchen}
              disabled={busy || !activeOrder?.id}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-on-primary transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-50"
            >
              <Send size={16} />
              Send to kitchen
            </button>
            <div className="grid grid-cols-3 gap-2">
              {['cash', 'upi', 'card'].map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => finishPayment(method)}
                  disabled={busy || !activeOrder?.id}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-outline/10 bg-surface-container-high px-3 py-3 text-xs font-bold uppercase tracking-wider text-secondary transition-colors hover:text-primary disabled:opacity-50"
                >
                  <CreditCard size={14} />
                  {method}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="rounded-2xl border border-outline/10 bg-surface-container-low px-4 py-3 text-xs text-secondary">
        <CheckCircle className="mr-2 inline-block text-emerald-600" size={14} />
        Cashier POS is table-driven. Customer display and kitchen screen will mirror this state in the next stage.
      </div>
    </div>
  );
};

export default Billing;
