import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Hash,
  Menu as MenuIcon,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  UserPlus,
  X,
  CreditCard,
  Smartphone,
} from 'lucide-react';
import api from '../../utils/api';

const formatMoney = (value) => `₹${Number(value || 0).toFixed(2)}`;

const SelfOrder = () => {
  const { tableId } = useParams();
  const [table, setTable] = useState(null);
  const [menu, setMenu] = useState([]);
  const [sessionActive, setSessionActive] = useState(false);
  const [session, setSession] = useState(null);
  const [order, setOrder] = useState(null);
  const [screen, setScreen] = useState('browse');
  const [showAuth, setShowAuth] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState({});
  const [confirmedQuantities, setConfirmedQuantities] = useState({});
  const [signup, setSignup] = useState({ name: '', phone_no: '', email: '' });
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [sessionPin, setSessionPin] = useState(
    () => sessionStorage.getItem(`self-order-pin-${tableId}`) || '',
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadPublicMenu = async () => {
    setError('');
    try {
      const response = await api.get('/self-order/menu', { params: { table_id: tableId } });
      setTable(response.data.table || null);
      setMenu(response.data.menu || []);
      setSessionActive(Boolean(response.data.session_active));
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not load the menu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPublicMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  const products = useMemo(
    () =>
      menu.flatMap((category) =>
        (category.items || []).map((item) => ({
          ...item,
          category_name: category.name,
          category_color: category.color || '#f59e0b',
        })),
      ),
    [menu],
  );

  const productById = useMemo(
    () => Object.fromEntries(products.map((product) => [String(product.id), product])),
    [products],
  );

  const visibleMenu = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return menu;
    return menu
      .map((category) => ({
        ...category,
        items: (category.items || []).filter(
          (item) =>
            item.name.toLowerCase().includes(query) ||
            (item.description || '').toLowerCase().includes(query),
        ),
      }))
      .filter((category) => category.items.length > 0);
  }, [menu, search]);

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, quantity]) => quantity > 0)
        .map(([productId, quantity]) => ({ ...productById[productId], quantity }))
        .filter((item) => item.id),
    [cart, productById],
  );

  const subtotal = cartItems.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0,
  );
  const tax = subtotal * 0.05;
  const total = subtotal + tax;
  const totalUnits = cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const hasConfirmedItems = Object.values(confirmedQuantities).some((quantity) => quantity > 0);

  const hydrateOrder = (nextOrder) => {
    const nextCart = {};
    const nextConfirmed = {};
    Object.values(nextOrder?.items || {}).forEach((item) => {
      const key = String(item.product_id);
      nextCart[key] = (nextCart[key] || 0) + Number(item.quantity || 0);
      nextConfirmed[key] =
        (nextConfirmed[key] || 0) + Number(item.confirmed_quantity || 0);
    });
    setCart(nextCart);
    setConfirmedQuantities(nextConfirmed);
  };

  const beginOrdering = (payload) => {
    setSession(payload.session || null);
    setOrder(payload.order || null);
    hydrateOrder(payload.order);
    const pin = payload.session?.session_pin;
    if (pin) {
      setSessionPin(pin);
      sessionStorage.setItem(`self-order-pin-${tableId}`, pin);
    }
    setShowAuth(false);
    setScreen('order');
    setSessionActive(true);
  };

  const startSession = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await api.post(`/self-order/tables/${tableId}/start`, signup);
      beginOrdering(response.data);
      setMessage('Your table order is ready. Choose your items, then review and confirm.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not start the table order.');
      await loadPublicMenu();
    } finally {
      setBusy(false);
    }
  };

  const joinSession = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await api.post(`/self-order/tables/${tableId}/join`, {
        session_pin: sessionPin,
      });
      beginOrdering(response.data);
      setMessage('You joined the table order.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not join the table order.');
    } finally {
      setBusy(false);
    }
  };

  const changeQuantity = (productId, delta) => {
    const key = String(productId);
    const minimum = Number(confirmedQuantities[key] || 0);
    const availableToAdd = Number(productById[key]?.quantity_available || 0);
    const maximum = minimum + availableToAdd;
    setCart((current) => {
      const nextQuantity = Math.min(
        maximum,
        Math.max(minimum, Number(current[key] || 0) + delta),
      );
      return { ...current, [key]: nextQuantity };
    });
  };

  const confirmOrder = async () => {
    if (!order?.id || cartItems.length === 0) return;
    setBusy(true);
    setError('');
    try {
      const response = await api.post(`/self-order/orders/${order.id}/confirm`, {
        items: cartItems.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
        })),
      });
      setOrder(response.data);
      hydrateOrder(response.data);
      setScreen('payment');
      setMessage(
        hasConfirmedItems
          ? 'Your add-on items were confirmed and sent to the kitchen.'
          : 'Your order was confirmed and sent to the kitchen.',
      );
      await loadPublicMenu();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not confirm the order.');
    } finally {
      setBusy(false);
    }
  };

  const payForOrder = async () => {
    if (!order?.id) return;
    setBusy(true);
    setError('');
    try {
      const response = await api.post(`/self-order/orders/${order.id}/pay`, {
        payment_method: paymentMethod,
      });
      setOrder(response.data);
      setScreen('confirmed');
      setMessage('Payment completed successfully. Your bill is settled.');
      await loadPublicMenu();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not complete payment.');
    } finally {
      setBusy(false);
    }
  };

  const scrollToCategory = (categoryId) => {
    document.getElementById(`category-${categoryId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
    setShowCategories(false);
  };

  const openOrderGate = () => {
    setError('');
    setMessage('');
    setShowAuth(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-secondary">
        Loading menu...
      </div>
    );
  }

  const categoryNavigation = (
    <nav className="space-y-2">
      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.28em] text-outline">
        Categories
      </p>
      {menu.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => scrollToCategory(category.id)}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold transition-colors hover:bg-surface-container-high"
        >
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: category.color || '#f59e0b' }}
          />
          {category.name}
        </button>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="sticky top-0 z-30 border-b border-outline/10 bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 md:px-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">
              Customer Menu
            </p>
            <h1 className="font-headline text-xl font-black md:text-2xl">
              Table {table?.table_number || tableId}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCategories(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-outline/10 bg-surface-container-low lg:hidden"
              aria-label="Open categories"
            >
              <MenuIcon size={19} />
            </button>
            {screen === 'browse' && (
              <button
                type="button"
                onClick={openOrderGate}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-on-primary"
              >
                <ShoppingBag size={17} />
                Place order
              </button>
            )}
            {(screen === 'order' || screen === 'review') && (
              <div className="rounded-2xl border border-outline/10 bg-surface-container-low px-3 py-2 text-right">
                <p className="text-[9px] font-bold uppercase tracking-wider text-outline">Table PIN</p>
                <p className="font-black">{session?.session_pin}</p>
              </div>
            )}
          </div>
        </div>
      </header>

      {showCategories && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowCategories(false)}
            aria-label="Close categories"
          />
          <aside className="absolute bottom-0 left-0 top-0 w-72 overflow-y-auto bg-surface p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-headline text-xl font-black">Browse menu</h2>
              <button
                type="button"
                onClick={() => setShowCategories(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high"
              >
                <X size={18} />
              </button>
            </div>
            {categoryNavigation}
          </aside>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        {message && (
          <div className="mb-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-5 flex items-start gap-2 rounded-2xl border border-error/20 bg-error-container/30 px-4 py-3 text-sm text-error">
            <AlertTriangle className="mt-0.5 shrink-0" size={16} />
            {error}
          </div>
        )}

        {screen !== 'review' && screen !== 'payment' && screen !== 'confirmed' && (
          <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="hidden lg:block">
              <div className="sticky top-28 rounded-3xl border border-outline/10 bg-surface-container-low p-4">
                {categoryNavigation}
              </div>
            </aside>

            <main>
              <div className="mb-6 rounded-3xl border border-outline/10 bg-surface-container-low p-5 md:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-primary">
                      {screen === 'browse' ? 'Browse freely — no login required' : 'Build your order'}
                    </p>
                    <h2 className="mt-1 font-headline text-3xl font-black">
                      {screen === 'browse' ? 'What are you craving?' : 'Choose your items'}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm text-secondary">
                      {screen === 'browse'
                        ? 'The complete menu is below, grouped by category. You only enter your details when you decide to order.'
                        : hasConfirmedItems
                          ? 'You can add more items. Already confirmed quantities are locked and cannot be reduced.'
                          : 'Change quantities as much as you like. Nothing is deducted until you confirm the order.'}
                    </p>
                  </div>
                  <div className="relative w-full md:max-w-sm">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-outline"
                      size={17}
                    />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search the menu"
                      className="w-full rounded-2xl border border-outline/10 bg-surface-container-lowest py-3 pl-10 pr-4 text-sm outline-none focus:border-primary/40"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-8 pb-28">
                {visibleMenu.map((category) => (
                  <section
                    id={`category-${category.id}`}
                    key={category.id}
                    className="scroll-mt-28"
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <span
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: category.color || '#f59e0b' }}
                      />
                      <h3 className="font-headline text-2xl font-black">{category.name}</h3>
                      <div className="h-px flex-1 bg-outline/10" />
                    </div>
                    <div className="overflow-hidden rounded-3xl border border-outline/10 bg-surface-container-low">
                      {(category.items || []).map((item, index) => {
                        const key = String(item.id);
                        const quantity = Number(cart[key] || 0);
                        const minimum = Number(confirmedQuantities[key] || 0);
                        const soldOut = Number(item.quantity_available || 0) <= 0;
                        return (
                          <article
                            key={item.id}
                            className={`flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between ${
                              index > 0 ? 'border-t border-outline/10' : ''
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-headline text-lg font-bold">{item.name}</h4>
                                {soldOut && (
                                  <span className="rounded-full bg-error-container px-2 py-1 text-[10px] font-black uppercase text-error">
                                    Sold out
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-sm text-secondary">
                                {item.description || 'Freshly prepared to order.'}
                              </p>
                              <p className="mt-2 font-black text-primary">{formatMoney(item.price)}</p>
                            </div>

                            {screen === 'order' && (
                              <div className="flex shrink-0 items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => changeQuantity(item.id, -1)}
                                  disabled={quantity <= minimum}
                                  className="flex h-11 w-11 items-center justify-center rounded-full border border-outline/10 bg-surface-container-lowest disabled:cursor-not-allowed disabled:opacity-30"
                                  aria-label={`Remove one ${item.name}`}
                                >
                                  <Minus size={16} />
                                </button>
                                <div className="min-w-10 text-center">
                                  <p className="text-lg font-black">{quantity}</p>
                                  {minimum > 0 && (
                                    <p className="text-[9px] font-bold uppercase text-outline">
                                      {minimum} locked
                                    </p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => changeQuantity(item.id, 1)}
                                  disabled={soldOut}
                                  className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-on-primary disabled:cursor-not-allowed disabled:opacity-30"
                                  aria-label={`Add one ${item.name}`}
                                >
                                  <Plus size={16} />
                                </button>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </main>
          </div>
        )}

        {screen === 'review' && (
          <main className="mx-auto max-w-3xl pb-10">
            <button
              type="button"
              onClick={() => setScreen('order')}
              className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-secondary"
            >
              <ChevronLeft size={17} />
              Back to menu
            </button>
            <div className="rounded-3xl border border-outline/10 bg-surface-container-low p-5 md:p-7">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">
                Review order
              </p>
              <h2 className="mt-2 font-headline text-3xl font-black">Confirm your items</h2>
              <p className="mt-2 text-sm text-secondary">
                Inventory is deducted only when you press confirm. After that, these quantities
                cannot be reduced, but you can return and add more.
              </p>

              <div className="mt-6 overflow-hidden rounded-2xl border border-outline/10 bg-surface-container-lowest">
                {cartItems.map((item, index) => {
                  const key = String(item.id);
                  const minimum = Number(confirmedQuantities[key] || 0);
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between gap-4 p-4 ${
                        index > 0 ? 'border-t border-outline/10' : ''
                      }`}
                    >
                      <div>
                        <p className="font-bold">{item.name}</p>
                        <p className="text-sm text-secondary">
                          {item.quantity} × {formatMoney(item.price)}
                          {minimum > 0 && ` · ${minimum} already confirmed`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => changeQuantity(item.id, -1)}
                          disabled={item.quantity <= minimum}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-outline/10 disabled:opacity-30"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="min-w-7 text-center font-black">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => changeQuantity(item.id, 1)}
                          disabled={Number(item.quantity_available || 0) <= 0}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary disabled:opacity-30"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 space-y-2 rounded-2xl bg-surface-container-high p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-secondary">Subtotal</span>
                  <span className="font-bold">{formatMoney(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Tax</span>
                  <span className="font-bold">{formatMoney(tax)}</span>
                </div>
                <div className="flex justify-between border-t border-outline/10 pt-3 text-lg">
                  <span className="font-black">Total</span>
                  <span className="font-black text-primary">{formatMoney(total)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={confirmOrder}
                disabled={busy || cartItems.length === 0}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 font-black text-on-primary disabled:opacity-50"
              >
                <CheckCircle2 size={18} />
                {busy ? 'Confirming...' : hasConfirmedItems ? 'Confirm add-on items' : 'Confirm order'}
              </button>
            </div>
          </main>
        )}

        {screen === 'payment' && (
          <main className="mx-auto max-w-2xl py-8">
            <div className="rounded-3xl border border-outline/10 bg-surface-container-low p-7 md:p-10">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">
                Secure payment
              </p>
              <h2 className="mt-2 font-headline text-3xl font-black">Choose a payment method</h2>
              <p className="mt-3 text-sm text-secondary">
                Your order is already sent to the kitchen. Please complete payment to close the table bill.
              </p>

              <div className="mt-6 rounded-2xl border border-outline/10 bg-surface-container-lowest p-5">
                <div className="flex justify-between text-sm">
                  <span className="text-secondary">Order</span>
                  <span className="font-bold">{order?.bill_number}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-secondary">Total due</span>
                  <span className="font-black text-primary">{formatMoney(order?.total_amount)}</span>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('upi')}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    paymentMethod === 'upi'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-outline/10 bg-surface-container-lowest text-secondary'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Smartphone size={18} />
                    <span className="font-bold">UPI</span>
                  </div>
                  <p className="mt-2 text-xs">Use any UPI app to complete the payment.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    paymentMethod === 'card'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-outline/10 bg-surface-container-lowest text-secondary'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CreditCard size={18} />
                    <span className="font-bold">Card</span>
                  </div>
                  <p className="mt-2 text-xs">Tap or swipe your card at the counter.</p>
                </button>
              </div>

              <button
                type="button"
                onClick={payForOrder}
                disabled={busy}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 font-black text-on-primary disabled:opacity-50"
              >
                <CheckCircle2 size={18} />
                {busy ? 'Processing payment...' : 'Pay now'}
              </button>
            </div>
          </main>
        )}

        {screen === 'confirmed' && (
          <main className="mx-auto max-w-2xl py-8 text-center">
            <div className="rounded-3xl border border-emerald-500/20 bg-surface-container-low p-7 md:p-10">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700">
                <CheckCircle2 size={34} />
              </div>
              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.28em] text-emerald-700">
                Table released
              </p>
              <h2 className="mt-2 font-headline text-3xl font-black">Payment complete</h2>
              <p className="mt-3 text-sm text-secondary">
                Your payment is complete, the bill is closed, and the table has been released
                back to available status.
              </p>
              <div className="mt-6 rounded-2xl bg-surface-container-lowest p-5 text-left">
                <div className="flex justify-between text-sm">
                  <span className="text-secondary">Order</span>
                  <span className="font-bold">{order?.bill_number}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-secondary">Current total</span>
                  <span className="font-black text-primary">
                    {formatMoney(order?.total_amount)}
                  </span>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-secondary">Table PIN</span>
                  <span className="font-bold">{session?.session_pin}</span>
                </div>
              </div>
              <div className="mt-6 rounded-2xl border border-outline/10 bg-primary/5 px-4 py-3 text-sm text-secondary">
                You can close this screen now. If you need another order, a new table session will
                need to be started again from the QR flow.
              </div>
            </div>
          </main>
        )}
      </div>

      {screen === 'order' && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-outline/10 bg-surface/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 rounded-2xl bg-surface-container-high px-4 py-3">
            <div>
              <p className="text-xs font-bold text-secondary">{totalUnits} items</p>
              <p className="font-headline text-xl font-black">{formatMoney(total)}</p>
            </div>
            <button
              type="button"
              onClick={() => setScreen('review')}
              disabled={cartItems.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-on-primary disabled:opacity-40"
            >
              <ShoppingBag size={17} />
              View order
            </button>
          </div>
        </div>
      )}

      {showAuth && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl sm:rounded-3xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">
                  Place an order
                </p>
                <h2 className="mt-2 font-headline text-2xl font-black">
                  {sessionActive ? 'Join this table order' : 'Your details'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAuth(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high"
              >
                <X size={18} />
              </button>
            </div>

            {sessionActive ? (
              <form onSubmit={joinSession} className="mt-6 space-y-4">
                <div className="rounded-2xl bg-surface-container-low p-4 text-sm text-secondary">
                  This table already has an open order. Enter the 4-digit PIN from the first
                  customer to add items to the same bill.
                </div>
                <label className="grid gap-2 text-sm font-bold">
                  Table PIN
                  <div className="relative">
                    <Hash
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-outline"
                      size={17}
                    />
                    <input
                      value={sessionPin}
                      onChange={(event) =>
                        setSessionPin(event.target.value.replace(/\D/g, '').slice(0, 4))
                      }
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="0000"
                      className="w-full rounded-2xl border border-outline/10 bg-surface-container-low py-3 pl-10 pr-4 tracking-[0.35em] outline-none focus:border-primary/40"
                    />
                  </div>
                </label>
                <button
                  type="submit"
                  disabled={busy || sessionPin.length !== 4}
                  className="w-full rounded-2xl bg-primary px-4 py-4 font-black text-on-primary disabled:opacity-50"
                >
                  {busy ? 'Joining...' : 'Join and order'}
                </button>
              </form>
            ) : (
              <form onSubmit={startSession} className="mt-6 space-y-4">
                <label className="grid gap-2 text-sm font-bold">
                  Name
                  <input
                    required
                    value={signup.name}
                    onChange={(event) =>
                      setSignup((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Your name"
                    className="rounded-2xl border border-outline/10 bg-surface-container-low px-4 py-3 outline-none focus:border-primary/40"
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Phone number
                  <input
                    required
                    type="tel"
                    value={signup.phone_no}
                    onChange={(event) =>
                      setSignup((current) => ({ ...current, phone_no: event.target.value }))
                    }
                    placeholder="Mobile number"
                    className="rounded-2xl border border-outline/10 bg-surface-container-low px-4 py-3 outline-none focus:border-primary/40"
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Email <span className="font-normal text-secondary">(optional)</span>
                  <input
                    type="email"
                    value={signup.email}
                    onChange={(event) =>
                      setSignup((current) => ({ ...current, email: event.target.value }))
                    }
                    placeholder="Email address"
                    className="rounded-2xl border border-outline/10 bg-surface-container-low px-4 py-3 outline-none focus:border-primary/40"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 font-black text-on-primary disabled:opacity-50"
                >
                  <UserPlus size={18} />
                  {busy ? 'Starting...' : 'Continue to ordering'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SelfOrder;
