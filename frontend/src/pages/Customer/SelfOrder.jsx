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

const formatMoney = (value) => `Rs.${Number(value || 0).toFixed(2)}`;

const isCompletedStatus = (status) => status === 'done' || status === 'completed';
const isPreparingStatus = (status) => status === 'claimed' || status === 'preparing';

const SelfOrder = () => {
  const { tableId } = useParams();
  const [table, setTable] = useState(null);
  const [menu, setMenu] = useState([]);
  const [sessionActive, setSessionActive] = useState(false);
  const [session, setSession] = useState(null);
  const [order, setOrder] = useState(null);
  const [screen, setScreen] = useState('browse');
  const [showAuth, setShowAuth] = useState(false);
  const [authStep, setAuthStep] = useState('phone');
  const [customerTab, setCustomerTab] = useState('items');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState({});
  const [confirmedQuantities, setConfirmedQuantities] = useState({});
  const [signup, setSignup] = useState({ name: '', phone_no: '', email: '' });
  const [paymentMethod, setPaymentMethod] = useState('razorpay');
  const [allItemsDone, setAllItemsDone] = useState(false);
  const [statusChecking, setStatusChecking] = useState(false);
  const [sessionPin, setSessionPin] = useState(
    () => sessionStorage.getItem(`self-order-pin-${tableId}`) || '',
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loyaltyInfo, setLoyaltyInfo] = useState(null);
  const orderItems = useMemo(() => Object.values(order?.items || {}), [order]);
  const completedItems = orderItems.filter((item) => isCompletedStatus(item.status)).length;
  const isReadyForPayment = orderItems.length > 0 && completedItems === orderItems.length;
  const canProceedToPayment = allItemsDone || isReadyForPayment;

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(''), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!error) return undefined;
    const timer = setTimeout(() => setError(''), 5000);
    return () => clearTimeout(timer);
  }, [error]);

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

  useEffect(() => {
    if (!order?.id || (screen !== 'awaiting_payment' && screen !== 'payment')) return undefined;
    checkKitchenStatus(true);
    const interval = setInterval(() => checkKitchenStatus(true), 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, screen]);

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
  const placedOrderItems = orderItems;
  const customerTabs = [
    { id: 'items', label: 'Items' },
    { id: 'cart', label: 'Cart' },
    { id: 'orders', label: 'Orders' },
  ];

  const hydrateOrder = (nextOrder) => {
    const nextConfirmed = {};
    Object.values(nextOrder?.items || {}).forEach((item) => {
      const key = String(item.product_id);
      nextConfirmed[key] =
        (nextConfirmed[key] || 0) + Number(item.confirmed_quantity || 0);
    });
    setCart({});
    setConfirmedQuantities(nextConfirmed);
  };

  const checkKitchenStatus = async (silent = false) => {
    if (!order?.id) return false;
    if (!silent) {
      setStatusChecking(true);
      setError('');
    }
    try {
      const response = await api.get(`/self-order/orders/${order.id}`);
      const nextOrder = response.data.order || null;
      const nextOrderItems = Object.values(nextOrder?.items || {});
      const nextDone = nextOrderItems.length > 0 && nextOrderItems.every((item) => isCompletedStatus(item.status));
      if (nextOrder) {
        setOrder(nextOrder);
        hydrateOrder(nextOrder);
        if (nextOrder.loyalty) {
          setLoyaltyInfo(nextOrder.loyalty);
        }
      }
      setAllItemsDone(nextDone);
      if (nextOrder?.status === 'paid') {
        setScreen('confirmed');
        setMessage('Payment completed successfully. Your bill is settled.');
      } else if (nextDone) {
        if (screen !== 'payment') {
          setScreen('awaiting_payment');
        }
        if (!silent) {
          setMessage('All items are finished by the chef. You can now proceed to payment.');
        }
      } else if (screen !== 'payment') {
        setScreen('awaiting_payment');
        if (!silent) {
          setMessage('Food is yet to be prepared.');
        }
      }
      return nextDone;
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail || '';
      if (status === 404 || /not found/i.test(detail)) {
        setError('');
        setMessage('Food is yet to be prepared.');
        setScreen('awaiting_payment');
      } else if (!silent) {
        setError(detail || 'Could not check kitchen status.');
      }
      return false;
    } finally {
      if (!silent) {
        setStatusChecking(false);
      }
    }
  };

  useEffect(() => {
    if (!order?.id) return undefined;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socketUrl = `${protocol}://${window.location.hostname}:8000/ws/customer_display`;
    const socket = new WebSocket(socketUrl);

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const eventOrderId = payload.order_id ? Number(payload.order_id) : null;
        const eventTableId = payload.table_id ? Number(payload.table_id) : null;

        if (eventOrderId && eventOrderId !== Number(order.id)) return;
        if (eventTableId && table?.id && eventTableId !== Number(table.id)) return;

        if (payload.event === 'payment_completed') {
          setScreen('confirmed');
          setMessage('Payment completed successfully. Your bill is settled.');
          setAllItemsDone(true);
          loadPublicMenu();
          return;
        }

        if (['item_completed', 'order_sent_to_kitchen', 'cart_updated'].includes(payload.event)) {
          checkKitchenStatus(true);
        }
      } catch (error) {
        console.error('Failed to process customer websocket event', error);
      }
    };

    return () => socket.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, table?.id]);

  const beginOrdering = (payload) => {
    setSession(payload.session || null);
    setOrder(payload.order || null);
    hydrateOrder(payload.order);
    if (payload.order?.loyalty) {
      setLoyaltyInfo(payload.order.loyalty);
    } else {
      setLoyaltyInfo(null);
    }
    const pin = payload.session?.session_pin;
    if (pin) {
      setSessionPin(pin);
      sessionStorage.setItem(`self-order-pin-${tableId}`, pin);
    }
    setShowAuth(false);
    setAuthStep('phone');
    setCustomerTab('items');
    setScreen('order');
    setSessionActive(true);
  };

  const startSessionWithPayload = async (payload) => {
    setBusy(true);
    setError('');
    try {
      const response = await api.post(`/self-order/tables/${tableId}/start`, payload);
      beginOrdering(response.data);
      setMessage('Your table order is ready. Choose your items, then review and confirm.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not start the table order.');
      await loadPublicMenu();
    } finally {
      setBusy(false);
    }
  };

  const startSession = async (event) => {
    event.preventDefault();
    await startSessionWithPayload(signup);
  };

  const lookupCustomerAndContinue = async (event) => {
    event.preventDefault();
    if (!signup.phone_no.trim()) {
      setError('Phone number is required.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const response = await api.get('/self-order/customers/resolve', {
        params: { phone_number: signup.phone_no },
      });

      if (response.data?.exists) {
        const customer = response.data.customer || {};
        if (response.data.loyalty) {
          setLoyaltyInfo(response.data.loyalty);
        } else {
          setLoyaltyInfo(null);
        }
        await startSessionWithPayload({
          phone_no: signup.phone_no,
          name: customer.name || signup.name || '',
          email: customer.email || signup.email || '',
        });
        return;
      }

      setAuthStep('details');
      setMessage('No account found for this phone number. Please enter your name and email to continue.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not verify the phone number.');
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
      const desiredItems = new Map();

      Object.values(order?.items || {}).forEach((item) => {
        const productId = Number(item.product_id);
        const quantity = Number(item.quantity || 0);
        if (productId && quantity > 0) {
          desiredItems.set(productId, (desiredItems.get(productId) || 0) + quantity);
        }
      });

      cartItems.forEach((item) => {
        const productId = Number(item.id);
        const quantity = Number(item.quantity || 0);
        if (productId && quantity > 0) {
          desiredItems.set(productId, (desiredItems.get(productId) || 0) + quantity);
        }
      });

      const response = await api.post(`/self-order/orders/${order.id}/confirm`, {
        items: Array.from(desiredItems.entries()).map(([product_id, quantity]) => ({
          product_id,
          quantity,
        })),
      });
      setOrder(response.data);
      hydrateOrder(response.data);
      setCart({});
      setAllItemsDone(false);
      setCustomerTab('orders');
      setScreen('order');
      setMessage(
        hasConfirmedItems
          ? 'Your add-on items were placed. You can continue browsing the menu.'
          : 'Your order was placed. You can continue browsing the menu.',
      );
      await loadPublicMenu();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not confirm the order.');
    } finally {
      setBusy(false);
    }
  };

  const loadRazorpayScript = () => new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  const payForOrder = async () => {
    if (!order?.id) return;
    if (!canProceedToPayment) {
      const ready = await checkKitchenStatus();
      if (!ready) {
        setError('Please wait until the chef marks every item as done before payment.');
        return;
      }
    }
    setBusy(true);
    setError('');
    try {
      const response = await api.post(`/self-order/orders/${order.id}/pay`, {
        payment_method: paymentMethod,
      });

      if (paymentMethod === 'razorpay' && response.data?.payment_provider === 'razorpay') {
        const ready = await loadRazorpayScript();
        if (!ready) {
          throw new Error('Unable to load Razorpay checkout.');
        }

        const options = {
          key: response.data.key_id,
          amount: response.data.amount_paise,
          currency: response.data.currency || 'INR',
          name: 'Cafe Odoo',
          description: `Order ${response.data.order_number || order.order_number}`,
          order_id: response.data.razorpay_order_id,
          theme: {
            color: '#b44d2c',
          },
          handler: async (razorpayResponse) => {
            setBusy(true);
            try {
              const verifyRes = await api.post(`/self-order/orders/${order.id}/razorpay/verify`, {
                razorpay_order_id: razorpayResponse.razorpay_order_id,
                razorpay_payment_id: razorpayResponse.razorpay_payment_id,
                razorpay_signature: razorpayResponse.razorpay_signature,
              });
              setOrder(verifyRes.data);
              if (verifyRes.data?.loyalty) {
                setLoyaltyInfo(verifyRes.data.loyalty);
              } else {
                setLoyaltyInfo(null);
              }
              setScreen('confirmed');
              const pts = verifyRes.data?.loyalty_points_awarded;
              if (pts && pts > 0) {
                setMessage(`Payment completed successfully. Your bill is settled. You earned ${pts} loyalty points!`);
              } else {
                setMessage('Payment completed successfully. Your bill is settled.');
              }
              await loadPublicMenu();
            } catch (verifyErr) {
              setError(verifyErr.response?.data?.detail || 'Razorpay verification failed.');
            } finally {
              setBusy(false);
            }
          },
          modal: {
            ondismiss: () => setBusy(false),
          },
          prefill: {
            name: signup.name || 'Self Order Customer',
            contact: signup.phone_no || '',
          },
        };

        const razorpay = new window.Razorpay(options);
        razorpay.on('payment.failed', (failResponse) => {
          setError(failResponse.error?.description || 'UPI payment failed.');
          setBusy(false);
        });
        razorpay.open();
        return;
      }

      setOrder(response.data);
      if (response.data?.loyalty) {
        setLoyaltyInfo(response.data.loyalty);
      } else {
        setLoyaltyInfo(null);
      }
      setScreen('confirmed');
      const pts = response.data?.loyalty_points_awarded;
      if (pts && pts > 0) {
        setMessage(`Payment completed successfully. Your bill is settled. You earned ${pts} loyalty points!`);
      } else {
        setMessage('Payment completed successfully. Your bill is settled.');
      }
      await loadPublicMenu();
      setBusy(false);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not complete payment.');
      setBusy(false);
    }
  };

  const claimReward = async () => {
    const customerId = order?.customer?.id || order?.customer_id;
    if (!customerId) {
      setError('No customer associated with this session to claim reward.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await api.post(`/loyalty/${customerId}/claim-reward`);
      setMessage(response.data.message || 'Reward claimed! You get a free Signature Drink.');
      const remainingPoints = response.data.remaining_points !== undefined ? response.data.remaining_points : 0;
      setLoyaltyInfo((prev) => ({
        ...prev,
        total_points: remainingPoints,
        can_claim_reward: remainingPoints >= 50
      }));
      if (order?.id) {
        await checkKitchenStatus(true);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to claim reward.');
    } finally {
      setBusy(false);
    }
  };

  const openOrderGate = () => {
    setError('');
    setMessage('');
    setAuthStep('phone');
    setCustomerTab('items');
    setShowAuth(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-secondary">
        Loading menu...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="sticky top-0 z-30 border-b border-outline/10 bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">
              Customer Menu
            </p>
            <h1 className="font-headline text-lg font-black md:text-xl">
              Table {table?.table_number || tableId}
            </h1>
          </div>
          <div className="flex items-center gap-2">
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

      <div className="mx-auto max-w-6xl px-4 py-4 md:px-5">
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

        {screen !== 'review' && screen !== 'awaiting_payment' && screen !== 'payment' && screen !== 'confirmed' && !showAuth && (
          <div className="space-y-5">
            <main>
              <div className="mb-5 rounded-3xl border border-outline/10 bg-surface-container-low p-4 md:p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-primary">
                      {screen === 'browse' ? 'Browse freely — no login required' : 'Build your order'}
                    </p>
                    <h2 className="mt-1 font-headline text-2xl font-black md:text-[2rem]">
                      {screen === 'browse' ? 'What are you craving?' : 'Choose your items'}
                    </h2>
                    <p className="mt-2 max-w-2xl text-xs text-secondary md:text-sm">
                      {screen === 'browse'
                        ? 'The complete menu is below, grouped by category. You only enter your details when you decide to order.'
                        : hasConfirmedItems
                          ? 'You can add more items. Already confirmed quantities are locked and cannot be reduced.'
                          : 'Change quantities as much as you like. Nothing is deducted until you confirm the order.'}
                    </p>
                  </div>
                  <div className="relative w-full md:max-w-xs">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-outline"
                      size={16}
                    />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search the menu"
                      className="w-full rounded-2xl border border-outline/10 bg-surface-container-lowest py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary/40"
                    />
                  </div>
                </div>
              </div>

              {screen === 'order' && loyaltyInfo && (
                <div className="mb-5 rounded-3xl border border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5 p-4 md:p-5 relative overflow-hidden shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary">
                        <span className="text-xl font-bold">⭐</span>
                      </div>
                      <div>
                        <h3 className="font-headline text-lg font-black text-on-surface">
                          Welcome back, {order?.customer?.name || signup.name || 'Valued Customer'}!
                        </h3>
                        <p className="text-xs text-secondary">
                          You have <span className="font-bold text-primary">{loyaltyInfo.total_points}</span> loyalty points.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:items-end">
                      {loyaltyInfo.can_claim_reward ? (
                        <button
                          type="button"
                          onClick={claimReward}
                          disabled={busy}
                          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                          🎁 Claim free Signature Drink!
                        </button>
                      ) : (
                        <div className="text-xs font-semibold text-secondary">
                          {50 - loyaltyInfo.total_points} more points to get a free drink!
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-outline mb-1.5">
                      <span>Reward Progress</span>
                      <span>{loyaltyInfo.total_points} / 50 Points</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-surface-container-high overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
                        style={{ width: `${Math.min(100, (loyaltyInfo.total_points / 50) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-5 flex flex-wrap gap-2 rounded-3xl border border-outline/10 bg-surface-container-low p-2.5">
                {customerTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCustomerTab(tab.id)}
                    className={`rounded-2xl px-3.5 py-2 text-xs font-black transition-colors md:text-sm ${
                      customerTab === tab.id
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-lowest text-secondary hover:text-primary'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {customerTab === 'orders' && (
                <div className="mb-5 rounded-3xl border border-outline/10 bg-surface-container-low p-4 md:p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">
                        Orders
                      </p>
                      <h3 className="mt-1 font-headline text-xl font-black">Placed items</h3>
                    </div>
                    <span className="rounded-full bg-surface-container-high px-2.5 py-1 text-[11px] font-bold text-secondary">
                      {placedOrderItems.length} items
                    </span>
                  </div>
                  <div className="space-y-3">
                    {placedOrderItems.length === 0 ? (
                      <div className="rounded-2xl border border-outline/10 bg-surface-container-lowest px-4 py-3 text-sm text-secondary">
                        No placed items yet. Switch to Items or Cart to add something first.
                      </div>
                    ) : (
                      placedOrderItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-4 rounded-2xl border border-outline/10 bg-surface-container-lowest px-4 py-3"
                        >
                          <div>
                            <p className="font-semibold text-on-surface">{item.name}</p>
                            <p className="text-xs text-secondary">
                              {item.quantity} x {formatMoney(item.rate)}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                              isCompletedStatus(item.status)
                                ? 'bg-emerald-500/10 text-emerald-700'
                                : isPreparingStatus(item.status)
                                  ? 'bg-amber-500/10 text-amber-700'
                                  : 'bg-outline/10 text-secondary'
                            }`}
                          >
                            {item.status || 'to_cook'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-4 rounded-2xl border border-primary/10 bg-primary/5 px-4 py-2.5 text-sm text-secondary">
                    Payment stays locked until every placed item is prepared.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (canProceedToPayment) {
                        setScreen('payment');
                        return;
                      }
                      setScreen('awaiting_payment');
                    }}
                    disabled={!placedOrderItems.length}
                    className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 font-black transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      canProceedToPayment
                        ? 'bg-primary text-on-primary'
                        : 'border border-outline/10 bg-surface-container-lowest text-secondary'
                    }`}
                  >
                    <CreditCard size={18} />
                    {canProceedToPayment ? 'Proceed to payment' : 'Payment locked until items are done'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerTab('items')}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-outline/10 bg-surface-container-lowest px-4 py-3 font-black text-secondary"
                  >
                    Back to menu
                  </button>
                </div>
              )}

              {customerTab === 'cart' && (
                <div className="mb-5 rounded-3xl border border-outline/10 bg-surface-container-low p-4 md:p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">
                        Cart
                      </p>
                      <h3 className="mt-1 font-headline text-xl font-black">Current cart</h3>
                    </div>
                    <span className="rounded-full bg-surface-container-high px-2.5 py-1 text-[11px] font-bold text-secondary">
                      {cartItems.length} items
                    </span>
                  </div>

                  {cartItems.length === 0 ? (
                    <div className="rounded-2xl border border-outline/10 bg-surface-container-lowest px-4 py-3 text-sm text-secondary">
                      Your cart is empty. Switch to Items and add something to order.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cartItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-outline/10 bg-surface-container-lowest px-4 py-3"
                        >
                          <div>
                            <p className="font-semibold text-on-surface">{item.name}</p>
                            <p className="text-xs text-secondary">
                              {item.quantity} x {formatMoney(item.price)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => changeQuantity(item.id, -1)}
                              className="rounded-full bg-surface-container-high px-2.5 py-2 text-sm font-bold text-secondary"
                            >
                              -
                            </button>
                            <span className="min-w-6 text-center font-black">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => changeQuantity(item.id, 1)}
                              className="rounded-full bg-primary px-2.5 py-2 text-sm font-bold text-on-primary"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 rounded-2xl bg-surface-container-high p-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-secondary">Subtotal</span>
                      <span className="font-bold">{formatMoney(subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary">Tax</span>
                      <span className="font-bold">{formatMoney(tax)}</span>
                    </div>
                    <div className="mt-2 flex justify-between border-t border-outline/10 pt-3 text-lg">
                      <span className="font-black">Total</span>
                      <span className="font-black text-primary">{formatMoney(total)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={confirmOrder}
                    disabled={busy || cartItems.length === 0}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-black text-on-primary disabled:opacity-50"
                  >
                    <CheckCircle2 size={18} />
                    {busy ? 'Placing order...' : hasConfirmedItems ? 'Place add-on order' : 'Place order'}
                  </button>
                </div>
              )}

              {customerTab === 'items' && (
                <div className="space-y-6 pb-24">
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
                      <h3 className="font-headline text-xl font-black">{category.name}</h3>
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
                            className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${
                              index > 0 ? 'border-t border-outline/10' : ''
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-headline text-base font-bold md:text-lg">{item.name}</h4>
                                {soldOut && (
                                  <span className="rounded-full bg-error-container px-2 py-1 text-[10px] font-black uppercase text-error">
                                    Sold out
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-secondary md:text-sm">
                                {item.description || 'Freshly prepared to order.'}
                              </p>
                              <p className="mt-2 text-sm font-black text-primary md:text-base">{formatMoney(item.price)}</p>
                            </div>

                            {screen === 'order' && (
                              <div className="flex shrink-0 items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => changeQuantity(item.id, -1)}
                                  disabled={quantity <= minimum}
                                  className="flex h-9 w-9 items-center justify-center rounded-full border border-outline/10 bg-surface-container-lowest disabled:cursor-not-allowed disabled:opacity-30"
                                  aria-label={`Remove one ${item.name}`}
                                >
                                  <Minus size={14} />
                                </button>
                                <div className="min-w-8 text-center">
                                  <p className="text-base font-black">{quantity}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => changeQuantity(item.id, 1)}
                                  disabled={soldOut}
                                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary disabled:cursor-not-allowed disabled:opacity-30"
                                  aria-label={`Add one ${item.name}`}
                                >
                                  <Plus size={14} />
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
              )}
            </main>
          </div>
        )}

        {screen === 'review' && (
          <main className="mx-auto max-w-2xl pb-8">
            <button
              type="button"
              onClick={() => setScreen('order')}
              className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-secondary"
            >
              <ChevronLeft size={17} />
              Back to menu
            </button>
            <div className="rounded-3xl border border-outline/10 bg-surface-container-low p-4 md:p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">
                Review order
              </p>
              <h2 className="mt-2 font-headline text-2xl font-black md:text-[2rem]">Confirm your items</h2>
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
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-black text-on-primary disabled:opacity-50"
              >
                <CheckCircle2 size={18} />
                {busy ? 'Confirming...' : hasConfirmedItems ? 'Confirm add-on items' : 'Confirm order'}
              </button>
            </div>
          </main>
        )}

        {screen === 'awaiting_payment' && (
          <main className="mx-auto max-w-2xl py-6">
            <div className="rounded-3xl border border-outline/10 bg-surface-container-low p-5 md:p-7">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">
                Waiting for chef
              </p>
              <h2 className="mt-2 font-headline text-2xl font-black md:text-[2rem]">Are all items done?</h2>
              <p className="mt-3 text-sm text-secondary">
                Payment is locked until the chef finishes every item for this table. We will move
                you to payment as soon as everything is marked done.
              </p>

              <div className="mt-6 rounded-2xl border border-outline/10 bg-surface-container-lowest p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-secondary">Items finished</span>
                  <span className="font-black text-on-surface">
                    {Object.values(order?.items || {}).filter((item) => isCompletedStatus(item.status)).length}/
                    {Object.keys(order?.items || {}).length}
                  </span>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-secondary">Total due later</span>
                  <span className="font-black text-primary">{formatMoney(order?.total_amount)}</span>
                </div>
                {order?.customer && Math.floor((order?.total_amount || 0) / 100) > 0 && (
                  <div className="mt-2 flex justify-between text-sm pt-2 border-t border-outline/10">
                    <span className="text-secondary flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-[#e85d04]">stars</span>
                      Points earned in this order
                    </span>
                    <span className="font-black text-[#e85d04]">
                      +{Math.floor((order?.total_amount || 0) / 100)} pts
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-6 space-y-3">
                {orderItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-2xl border border-outline/10 bg-surface-container-lowest px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-on-surface">{item.name}</p>
                      <p className="text-xs text-secondary">
                        {item.quantity} x {formatMoney(item.rate)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                        isCompletedStatus(item.status)
                          ? 'bg-emerald-500/10 text-emerald-700'
                          : isPreparingStatus(item.status)
                            ? 'bg-amber-500/10 text-amber-700'
                            : 'bg-outline/10 text-secondary'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3 text-sm text-secondary">
                Press "Check kitchen status" after the chef says everything is done, or wait for automatic detection.
              </div>

              <button
                type="button"
                onClick={() => {
                  if (canProceedToPayment) {
                    setScreen('payment');
                  }
                }}
                disabled={!canProceedToPayment}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 font-black text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 size={18} />
                {canProceedToPayment ? 'Proceed to payment' : 'Payment locked until all items are done'}
              </button>

              <button
                type="button"
                onClick={() => checkKitchenStatus()}
                disabled={statusChecking}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-black text-on-primary disabled:opacity-50"
              >
                {statusChecking ? 'Checking...' : 'Check kitchen status'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setScreen('order');
                  setError('');
                  setMessage('');
                }}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-outline/10 bg-surface-container-lowest px-4 py-3 font-black text-secondary"
              >
                Return to order
              </button>
            </div>
          </main>
        )}

        {screen === 'payment' && (
          <main className="mx-auto max-w-2xl py-6">
            <div className="rounded-3xl border border-outline/10 bg-surface-container-low p-5 md:p-7">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">
                Secure payment
              </p>
              <h2 className="mt-2 font-headline text-2xl font-black md:text-[2rem]">Choose a payment method</h2>
              <p className="mt-3 text-sm text-secondary">
                All items are done. Please complete payment to close the table bill.
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

              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('razorpay')}
                  className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                    paymentMethod === 'razorpay'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-outline/10 bg-surface-container-lowest text-secondary'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Smartphone size={18} />
                    <span className="font-bold">Pay Online</span>
                  </div>
                  <p className="mt-2 text-xs">Securely pay via UPI, Credit/Debit Card, or Netbanking using Razorpay.</p>
                </button>
              </div>

              <button
                type="button"
                onClick={payForOrder}
                disabled={busy || !canProceedToPayment}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-black text-on-primary disabled:opacity-50"
              >
                <CheckCircle2 size={18} />
                {busy ? 'Processing payment...' : 'Pay now'}
              </button>
            </div>
          </main>
        )}

        {screen === 'confirmed' && (
          <main className="mx-auto max-w-2xl py-6 text-center">
            <div className="rounded-3xl border border-emerald-500/20 bg-surface-container-low p-5 md:p-7">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700">
                <CheckCircle2 size={34} />
              </div>
              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.28em] text-emerald-700">
                Table released
              </p>
              <h2 className="mt-2 font-headline text-2xl font-black md:text-[2rem]">Payment complete</h2>
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
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-outline/10 bg-surface/95 p-2.5 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-2xl bg-surface-container-high px-4 py-2.5">
            <div>
              <p className="text-xs font-bold text-secondary">{totalUnits} items</p>
              <p className="font-headline text-lg font-black">{formatMoney(subtotal)}</p>
            </div>
            <button
              type="button"
              onClick={() => setScreen('review')}
              disabled={cartItems.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-black text-on-primary disabled:opacity-40"
            >
              <ShoppingBag size={17} />
              View Cart
            </button>
          </div>
        </div>
      )}

      {showAuth && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-4 shadow-2xl sm:rounded-3xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">
                  Place an order
                </p>
                <h2 className="mt-2 font-headline text-xl font-black md:text-2xl">
                      {sessionActive ? 'Join this table order' : authStep === 'phone' ? 'Enter phone number' : 'Your details'}
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
                  className="w-full rounded-2xl bg-primary px-4 py-3 font-black text-on-primary disabled:opacity-50"
                >
                  {busy ? 'Joining...' : 'Join and order'}
                </button>
              </form>
            ) : (
              authStep === 'phone' ? (
                <form onSubmit={lookupCustomerAndContinue} className="mt-6 space-y-4">
                  <div className="rounded-2xl bg-surface-container-low p-4 text-sm text-secondary">
                    Enter your phone number first. If we find your account, we’ll log you in right away. If not, we’ll ask for your name and email.
                  </div>
                  <label className="grid gap-2 text-sm font-bold">
                    Phone number
                    <input
                      required
                      type="tel"
                      pattern="[0-9]{10}"
                      maxLength="10"
                      minLength="10"
                      title="Mobile number must be exactly 10 digits"
                      value={signup.phone_no}
                      onChange={(event) =>
                        setSignup((current) => ({ ...current, phone_no: event.target.value }))
                      }
                      placeholder="Mobile number"
                      className="rounded-2xl border border-outline/10 bg-surface-container-low px-4 py-3 outline-none focus:border-primary/40"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-black text-on-primary disabled:opacity-50"
                  >
                    <UserPlus size={18} />
                    {busy ? 'Checking...' : 'Continue'}
                  </button>
                </form>
              ) : (
                <form onSubmit={startSession} className="mt-6 space-y-4">
                  <div className="rounded-2xl bg-surface-container-low p-4 text-sm text-secondary">
                    We could not find an account for this phone number. Please enter your name and email to create one and continue.
                  </div>
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
                      pattern="[0-9]{10}"
                      maxLength="10"
                      minLength="10"
                      title="Mobile number must be exactly 10 digits"
                      value={signup.phone_no}
                      onChange={(event) =>
                        setSignup((current) => ({ ...current, phone_no: event.target.value }))
                      }
                      placeholder="Mobile number"
                      className="rounded-2xl border border-outline/10 bg-surface-container-low px-4 py-3 outline-none focus:border-primary/40"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-bold">
                    Email
                    <input
                      required
                      type="email"
                      pattern=".*@.*"
                      title="Please include an '@' in the email address."
                      value={signup.email}
                      onChange={(event) =>
                        setSignup((current) => ({ ...current, email: event.target.value }))
                      }
                      placeholder="Email address"
                      className="rounded-2xl border border-outline/10 bg-surface-container-low px-4 py-3 outline-none focus:border-primary/40"
                    />
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setAuthStep('phone')}
                      className="inline-flex w-1/3 items-center justify-center gap-2 rounded-2xl border border-outline/10 bg-surface-container-low px-4 py-3 font-black text-secondary"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={busy}
                      className="inline-flex w-2/3 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-black text-on-primary disabled:opacity-50"
                    >
                      <UserPlus size={18} />
                      {busy ? 'Starting...' : 'Create account and continue'}
                    </button>
                  </div>
                </form>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SelfOrder;
