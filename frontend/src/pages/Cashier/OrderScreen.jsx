import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../utils/api';
import { ArrowLeft, Search, ShoppingCart, CreditCard, UserPlus } from 'lucide-react';
import { groupOrderItems } from '../../utils/orderItems';

const OrderScreen = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCat, setActiveCat] = useState('all');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [billSummary, setBillSummary] = useState(null);
  const [receivedCash, setReceivedCash] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState(1);
  const [upiBusy, setUpiBusy] = useState(false);

  // Customer Management States
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearchText, setCustomerSearchText] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [isRegisteringNewCust, setIsRegisteringNewCust] = useState(false);
  const [customerLoyalty, setCustomerLoyalty] = useState(null);

  // Receipt Modal State
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const loadCustomerLoyalty = async (customerId) => {
    if (!customerId) {
      setCustomerLoyalty(null);
      return;
    }
    try {
      const res = await api.get(`/cashier/customers/${customerId}/loyalty`);
      setCustomerLoyalty(res.data || null);
    } catch (err) {
      console.error('Failed to load customer loyalty info', err);
      setCustomerLoyalty(null);
    }
  };

  const loadBillSummary = async (orderId = currentOrder?.id) => {
    if (!orderId) {
      setBillSummary(null);
      return;
    }

    try {
      const res = await api.get(`/cashier/orders/${orderId}/bill-summary`);
      setBillSummary(res.data || null);
    } catch (err) {
      setBillSummary(null);
    }
  };

  const ensureActiveOrder = async () => {
    if (currentOrder?.id) {
      return currentOrder;
    }

    const res = await api.post('/cashier/orders', {
      source: 'cashier',
      table_id: Number(tableId),
      items: [],
    });
    const nextOrder = res.data || null;
    setCurrentOrder(nextOrder);
    if (nextOrder?.id) {
      await loadBillSummary(nextOrder.id);
    }
    return nextOrder;
  };

  const resetForNextCustomer = () => {
    setCart([]);
    setReceivedCash('');
    setBillSummary(null);
    setCustomerSearchText('');
    setCustomerSearchResults([]);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustEmail('');
    setIsRegisteringNewCust(false);
    setShowCustomerModal(false);
    setCustomerLoyalty(null);
  };

  const loadData = async () => {
    setError('');
    try {
      const [productsRes, categoriesRes, orderRes] = await Promise.allSettled([
        api.get('/inventory/products'),
        api.get('/inventory/categories'),
        api.get(`/cashier/tables/${tableId}/current-order`),
      ]);

      setProducts(productsRes.status === 'fulfilled' ? (productsRes.value.data || []) : []);
      setCategories(categoriesRes.status === 'fulfilled' ? (categoriesRes.value.data || []) : []);

      if (orderRes.status === 'rejected') {
        const orderErr = orderRes.reason;
        if (orderErr.response?.status === 404) {
          setCurrentOrder(null);
          setBillSummary(null);
          return;
        }

        setError(orderErr.response?.data?.detail || 'Failed to load table order.');
        setCurrentOrder(null);
        setBillSummary(null);
        return;
      }

      const orderData = orderRes.value.data || null;
      setCurrentOrder(orderData);
      if (orderData?.id) {
        await loadBillSummary(orderData.id);
      } else {
        setBillSummary(null);
      }
      const orderCustId = orderData?.customer_id || orderData?.customer?.id;
      if (orderCustId && !orderData?.customer?.is_guest) {
        await loadCustomerLoyalty(orderCustId);
      } else {
        setCustomerLoyalty(null);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load cashier data.');
      setCurrentOrder(null);
      setBillSummary(null);
    }
  };

  useEffect(() => {
    resetForNextCustomer();
    loadData();

    // Broadcast to CFD mirror that this table is now active
    if (tableId) {
      api.post('/cashier/cfd/set-table', { table_id: Number(tableId) }).catch(console.error);
    }

    return () => {
      // Clear CFD mirror on unmount
      api.post('/cashier/cfd/set-table', { table_id: null }).catch(console.error);
    };
  }, [tableId]);

  const handleCustomerSearch = async (text) => {
    setCustomerSearchText(text);
    if (!text.trim()) {
      setCustomerSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`/cashier/customers/search`, { params: { q: text } });
      setCustomerSearchResults(res.data || []);
    } catch (err) {
      setCustomerSearchResults([]);
      setError(err.response?.data?.detail || 'Failed to search customers.');
    }
  };

  const handleAssignCustomer = async (customerId) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const order = await ensureActiveOrder();
      if (!order?.id) {
        setError('No active bill found for this table. Please refresh and try again.');
        return;
      }

      const res = await api.patch(`/cashier/orders/${order.id}/customer`, { customer_id: customerId });
      setCurrentOrder(res.data || null);
      if (res.data?.id) {
        await loadBillSummary(res.data.id);
      }
      if (customerId) {
        await loadCustomerLoyalty(customerId);
      } else {
        setCustomerLoyalty(null);
      }
      setMessage('Customer assigned to this order successfully.');
      setShowCustomerModal(false);
      setCustomerSearchText('');
      setCustomerSearchResults([]);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to assign customer.');
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterAndAssignCustomer = async (e) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim() || !newCustEmail.trim()) {
      setError('Name, phone number, and email are required to add a customer.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const order = await ensureActiveOrder();
      if (!order?.id) {
        setError('No active bill found for this table. Please refresh and try again.');
        return;
      }

      // 1. Register the customer profile
      const regRes = await api.post('/cashier/customers', {
        name: newCustName.trim(),
        mobile_number: newCustPhone.trim(),
        email: newCustEmail.trim(),
      });
      const newCustomer = regRes.data;
      if (!newCustomer?.id) {
        throw new Error('Failed to register customer profile: Invalid response from server.');
      }

      // 2. Assign the customer ID to the order
      const assignRes = await api.patch(`/cashier/orders/${order.id}/customer`, {
        customer_id: newCustomer.id,
      });

      setCurrentOrder(assignRes.data || null);
      if (assignRes.data?.id) {
        await loadBillSummary(assignRes.data.id);
      }
      if (newCustomer.id) {
        await loadCustomerLoyalty(newCustomer.id);
      }
      setMessage('New customer registered and assigned successfully.');
      setShowCustomerModal(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustEmail('');
      setIsRegisteringNewCust(false);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to register customer.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveCustomer = async () => {
    if (!currentOrder?.id) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await api.patch(`/cashier/orders/${currentOrder.id}/customer`, { customer_id: null });
      setCurrentOrder(res.data || null);
      if (res.data?.id) {
        await loadBillSummary(res.data.id);
      }
      setCustomerLoyalty(null);
      setMessage('Customer profile unlinked from order.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to remove customer.');
    } finally {
      setBusy(false);
    }
  };

  const handleClaimReward = async () => {
    if (!selectedCustomer?.id) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post(`/loyalty/${selectedCustomer.id}/claim-reward`);
      setMessage(res.data?.message || 'Loyalty reward claimed successfully!');
      await loadCustomerLoyalty(selectedCustomer.id);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to claim loyalty reward.');
    } finally {
      setBusy(false);
    }
  };

  const openCustomerModal = () => {
    setError('');
    setIsRegisteringNewCust(false);
    if (currentOrder?.id) {
      setShowCustomerModal(true);
      return;
    }

    ensureActiveOrder()
      .then((order) => {
        if (order?.id) {
          setShowCustomerModal(true);
          return;
        }
        setError('No active bill found for this table. Please wait for the order to load.');
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'Failed to start a bill for this table.');
      });
  };

  const startRegisteringCustomer = () => {
    setError('');
    setIsRegisteringNewCust(true);
    setNewCustPhone((prev) => prev || customerSearchText.trim());
  };

  const currentItems = useMemo(() => groupOrderItems(currentOrder?.items || []), [currentOrder]);
  const orderLineItems = useMemo(() => (
    currentItems.map((item) => ({
      id: `order-${item.id}`,
      name: item.product_name || item.name,
      quantity: Number(item.quantity || 0),
      unit_price: Number(item.unit_price || item.rate || item.price || 0),
      line_total: Number(item.line_total || 0),
      source: 'order',
    }))
  ), [currentItems]);
  const cartLineItems = useMemo(() => (
    cart.map((item) => ({
      id: `cart-${item.id}`,
      name: item.name,
      quantity: Number(item.quantity || 0),
      unit_price: Number(item.price || 0),
      line_total: Number(item.price || 0) * Number(item.quantity || 0),
      source: 'cart',
    }))
  ), [cart]);
  const cumulativeItems = useMemo(() => (
    [...orderLineItems, ...cartLineItems].reduce((items, item) => {
      const key = `${item.name}|${Number(item.unit_price).toFixed(2)}`;
      const existing = items.find((candidate) => candidate.key === key);
      if (existing) {
        existing.quantity += item.quantity;
        existing.line_total += item.line_total;
        existing.hasPendingCart = existing.hasPendingCart || item.source === 'cart';
        return items;
      }
      items.push({ ...item, key, hasPendingCart: item.source === 'cart' });
      return items;
    }, [])
  ), [orderLineItems, cartLineItems]);
  const cartSubtotal = cart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
  const cartTax = cartSubtotal * 0.05;
  const cartTotal = cartSubtotal + cartTax;
  const orderSubtotal = Number(
    currentOrder?.subtotal ?? currentItems.reduce((sum, item) => sum + (Number(item.unit_price || item.rate || item.price || 0) * Number(item.quantity || 0)), 0)
  );
  const orderTax = Number(currentOrder?.tax_total ?? (orderSubtotal * 0.05));
  const orderTotal = Number(currentOrder?.total ?? (orderSubtotal + orderTax));
  const totalPaid = Number(billSummary?.total_paid ?? 0);
  const cumulativeSubtotal = orderSubtotal + cartSubtotal;
  const cumulativeTax = orderTax + cartTax;
  const cumulativeTotal = orderTotal + cartTotal;
  const balanceDue = Math.max(cumulativeTotal - totalPaid, 0);
  const paymentHistory = billSummary?.payments || [];
  const selectedCustomer = currentOrder?.customer && !currentOrder.customer.is_guest ? currentOrder.customer : null;

  // Sync live state to CFD
  useEffect(() => {
    if (tableId) {
      api.post('/cashier/cfd/sync', {
        table_id: Number(tableId),
        cart: cart,
        order_items: orderLineItems,
        customer: selectedCustomer || null,
        totals: {
          subtotal: cumulativeSubtotal,
          tax: cumulativeTax,
          total: cumulativeTotal,
          balance_due: balanceDue
        }
      }).catch(console.error);
    }
  }, [cart, orderLineItems, cumulativeSubtotal, cumulativeTax, cumulativeTotal, balanceDue, selectedCustomer, tableId]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = activeCat === 'all' || product.category_id === Number(activeCat);
      return matchesSearch && matchesCat && product.is_active;
    });
  }, [products, searchQuery, activeCat]);

  const handleAddToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) => (
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        ));
      }
      return [...prev, {
        id: product.id,
        name: product.name,
        price: Number(product.price),
        quantity: 1,
      }];
    });
    setMessage(`${product.name} added to the temporary cart.`);
  };

  const handleUpdateQty = (prodId, delta) => {
    setCart((prev) => prev
      .map((item) => (
        item.id === prodId ? { ...item, quantity: item.quantity + delta } : item
      ))
      .filter((item) => item.quantity > 0));
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

  const handlePayBill = async () => {
    if (!selectedCustomer) {
      setError('Select or register a customer with phone number before payment.');
      setShowCustomerModal(true);
      return;
    }
    if (balanceDue <= 0) {
      setError('This bill has no pending balance.');
      return;
    }
    if (paymentMethodId === 1 && receivedCash && Number(receivedCash) < balanceDue) {
      setError('Received cash is less than the bill total.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const order = currentOrder?.id ? currentOrder : await ensureActiveOrder();
      if (!order?.id) {
        setError('No active bill found for this table.');
        return;
      }

      if (cart.length > 0) {
        await api.put(`/cashier/orders/${order.id}/items`, cart.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
        })));
      }

      const paymentMethodPayload = {
        payment_method_id: Number(paymentMethodId),
        amount_received: paymentMethodId === 1 && receivedCash ? Number(receivedCash) : balanceDue,
      };

      const res = await api.post(`/cashier/orders/${order.id}/pay-and-send`, paymentMethodPayload);

      if (paymentMethodId === 3 && res.data?.payment_provider === 'razorpay') {
        setCart([]);
        const ready = await loadRazorpayScript();
        if (!ready) {
          throw new Error('Unable to load Razorpay checkout.');
        }

        const options = {
          key: res.data.key_id,
          amount: res.data.amount_paise,
          currency: res.data.currency || 'INR',
          name: 'Cafe Odoo',
          description: `Order ${res.data.order_number || currentOrder.order_number}`,
          order_id: res.data.razorpay_order_id,
          theme: {
            color: '#b44d2c',
          },
          handler: async (response) => {
            setUpiBusy(true);
            try {
              const verifyRes = await api.post(`/cashier/orders/${order.id}/razorpay/verify`, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              const verifyPts = verifyRes.data?.loyalty_points_awarded;
              const verifyLoyaltyMsg = verifyPts && verifyPts > 0 ? ` Customer earned ${verifyPts} loyalty points!` : '';
              await api.post(`/cashier/tables/${tableId}/release`);
              setMessage(`UPI payment recorded. Change due: Rs.${Number(verifyRes.data.change_due || 0).toFixed(2)}.${verifyLoyaltyMsg} Ready for the next customer.`);
              resetForNextCustomer();
              await loadData();
            } catch (verifyErr) {
              setError(verifyErr.response?.data?.detail || 'Razorpay verification failed.');
            } finally {
              setUpiBusy(false);
            }
          },
          modal: {
            ondismiss: () => setUpiBusy(false),
          },
          prefill: {
            name: 'Cashier desk',
          },
        };

        const razorpay = new window.Razorpay(options);
        razorpay.on('payment.failed', (response) => {
          setError(response.error?.description || 'UPI payment failed.');
          setUpiBusy(false);
        });
        razorpay.open();
        return;
      }

      const pts = res.data?.loyalty_points_awarded;
      const loyaltyMsg = pts && pts > 0 ? ` Customer earned ${pts} loyalty points!` : '';
      await api.post(`/cashier/tables/${tableId}/release`);
      setMessage(`Payment recorded. Change due: Rs.${Number(res.data.change_due || 0).toFixed(2)}.${loyaltyMsg} Ready for the next customer.`);
      resetForNextCustomer();
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to complete payment.');
    } finally {
      setBusy(false);
    }
  };

  const handleSendToKitchen = async () => {
    if (cart.length === 0) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const order = currentOrder?.id ? currentOrder : await ensureActiveOrder();
      if (!order?.id) {
        setError('No active bill found for this table.');
        return;
      }

      await api.put(`/cashier/orders/${order.id}/items`, cart.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
      })));
      await api.post(`/cashier/orders/${order.id}/send-to-kitchen`);
      setMessage('Items sent to the kitchen successfully.');
      setCart([]);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send items to kitchen.');
    } finally {
      setBusy(false);
    }
  };

  const handleFinishOrder = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post(`/cashier/tables/${tableId}/release`);
      setMessage(res.data?.message || 'Table released successfully.');
      resetForNextCustomer();
      setCurrentOrder(null);
      navigate('/cashier/tables');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to finish the bill.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-57px)] flex flex-col lg:flex-row bg-surface-container font-body">
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/cashier/tables')} className="p-2 hover:bg-surface-container-high rounded-full">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-headline font-bold text-xl text-on-surface">Table {tableId} Bill</h1>
            <p className="text-secondary text-xs">Add items here, then send them to the chef.</p>
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

        <div className="rounded-2xl border border-outline/10 bg-surface-container-low p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Customer</p>
              {selectedCustomer ? (
                <div className="mt-1 flex flex-col gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-headline text-lg font-bold text-on-surface">{selectedCustomer.name}</h2>
                      {customerLoyalty && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                          ⭐ {customerLoyalty.loyalty_points} pts
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-secondary">
                      {selectedCustomer.mobile_number}
                      {selectedCustomer.email ? ` | ${selectedCustomer.email}` : ''}
                    </p>
                  </div>
                  {customerLoyalty?.can_claim_reward && (
                    <div className="mt-1">
                      <button
                        type="button"
                        onClick={handleClaimReward}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50 transition-all"
                      >
                        🎁 Claim Free Drink
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-1">
                  <h2 className="font-headline text-lg font-bold text-on-surface">No customer selected</h2>
                  <p className="text-xs text-secondary">Search by phone, or register a new customer before payment.</p>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {selectedCustomer && (
                <button
                  type="button"
                  onClick={handleRemoveCustomer}
                  disabled={busy}
                  className="rounded-xl border border-outline/20 bg-surface-container-lowest px-4 py-2 text-xs font-semibold text-secondary hover:bg-surface-container-high disabled:opacity-50"
                >
                  Change
                </button>
              )}
              <button
                type="button"
                onClick={openCustomerModal}
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-on-primary shadow hover:bg-primary/95 disabled:opacity-50"
              >
                <UserPlus size={14} />
                {selectedCustomer ? 'Select Customer' : 'Add Customer'}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-outline/10 bg-surface-container-low p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Menu</p>
              <h2 className="font-headline text-lg font-bold text-on-surface">Select items</h2>
            </div>
            <Search className="text-primary" size={18} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline/50" size={18} />
              <input
                type="text"
                placeholder="Search food items..."
                className="w-full rounded-2xl border border-outline/10 bg-surface-container-lowest py-3 pl-10 pr-4 text-sm outline-none focus:border-primary/30"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
              <button
                onClick={() => setActiveCat('all')}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold transition-colors ${activeCat === 'all' ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-high text-secondary hover:text-primary'}`}
              >
                All
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCat(category.id)}
                  className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold transition-colors ${activeCat === category.id ? 'text-white' : 'bg-surface-container-high text-secondary hover:text-primary'}`}
                  style={activeCat === category.id ? { backgroundColor: category.color_hex, borderColor: category.color_hex } : {}}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => handleAddToCart(product)}
                className="rounded-2xl border border-outline/10 bg-surface-container-lowest p-3 text-left transition-all hover:border-primary/30"
              >
                <p className="font-semibold text-on-surface line-clamp-2">{product.name}</p>
                <p className="mt-1 text-[10px] text-outline uppercase">{product.uom}</p>
                <div className="mt-3 flex items-center justify-between border-t border-outline/5 pt-2">
                  <span className="text-sm font-bold text-primary">Rs.{Number(product.price).toFixed(2)}</span>
                  <span className="text-[10px] text-outline">{product.is_active ? 'Active' : 'Inactive'}</span>
                </div>
              </button>
            ))}
          </div>

          </div>
        </div>

      <div className="w-full lg:w-[450px] bg-surface border-l border-outline/10 p-6 flex flex-col justify-between h-[calc(100vh-57px)] sticky top-[57px]">
        <div className="space-y-5 overflow-y-auto flex-1 pr-1">
          <div className="flex justify-between items-center border-b border-outline/5 pb-3">
            <h3 className="font-headline font-bold text-base flex items-center gap-2 text-on-surface">
              <ShoppingCart size={18} />
              Bill Items
            </h3>
            <span className="text-xs font-semibold text-secondary">{orderLineItems.length} item(s)</span>
          </div>

            {orderLineItems.length === 0 && cart.length === 0 && (
              <p className="text-xs text-outline italic text-center py-8">Ordered items will appear here.</p>
            )}
            
            {orderLineItems.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl border border-outline/10 bg-surface-container-lowest p-3 text-sm opacity-75">
                <div>
                  <span className="font-bold text-on-surface">{item.name}</span>
                  <p className="text-[10px] text-secondary">
                    Rs.{Number(item.unit_price).toFixed(2)} each (Sent to Kitchen)
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-on-surface">x{Number(item.quantity)}</span>
                  <p className="text-[10px] font-semibold text-secondary">Rs.{Number(item.line_total).toFixed(2)}</p>
                </div>
              </div>
            ))}

            {cart.length > 0 && (
              <div className="mt-4 border-t border-outline/10 pt-4 space-y-3">
                <p className="text-[10px] font-bold uppercase text-primary tracking-wider">New Items (Not Sent)</p>
                {cart.map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-sm">
                    <div>
                      <span className="font-bold text-on-surface">{item.name}</span>
                      <p className="text-[10px] text-secondary">Rs.{item.price.toFixed(2)} each</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.id, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded border border-primary/20 bg-surface text-primary font-bold"
                        >
                          -
                        </button>
                        <span className="min-w-4 text-center text-xs font-bold">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.id, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded border border-primary/20 bg-surface text-primary font-bold"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-[10px] font-bold text-primary">Rs.{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
                <button
                  onClick={handleSendToKitchen}
                  disabled={busy}
                  className="w-full py-2 bg-surface-container-high border border-outline/20 text-on-surface font-semibold rounded-xl text-xs hover:bg-surface-container-highest transition-all"
                >
                  Send New Items to Kitchen
                </button>
              </div>
            )}

          <div className="rounded-2xl border border-outline/10 bg-surface-container-low p-3 text-xs space-y-2">
            <div className="flex justify-between text-secondary">
              <span>Subtotal</span>
              <span>Rs.{cumulativeSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-secondary">
              <span>Tax 5%</span>
              <span>Rs.{cumulativeTax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-outline/5 pt-2 text-sm font-bold text-on-surface">
              <span>Total amount</span>
              <span>Rs.{cumulativeTotal.toFixed(2)}</span>
            </div>
            {totalPaid > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Paid</span>
                <span>Rs.{totalPaid.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-primary font-bold">
              <span>Balance due</span>
              <span>Rs.{balanceDue.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="rounded-2xl border border-outline/10 bg-surface-container-low p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-headline text-sm font-bold text-on-surface">Payment</h3>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary">
                Payable Rs.{balanceDue.toFixed(2)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPaymentMethodId(1)}
                className={`py-2 text-xs font-bold rounded-lg border text-center transition-all ${paymentMethodId === 1 ? 'bg-primary text-on-primary border-primary' : 'bg-surface text-secondary border-outline/10'}`}
              >
                Cash
              </button>
              <button
                onClick={() => setPaymentMethodId(3)}
                className={`py-2 text-xs font-bold rounded-lg border text-center transition-all ${paymentMethodId === 3 ? 'bg-primary text-on-primary border-primary' : 'bg-surface text-secondary border-outline/10'}`}
              >
                UPI
              </button>
            </div>

            {paymentMethodId === 1 && (
              <div className="space-y-1.5">
                <label className="block text-[10px] font-semibold text-secondary uppercase mb-1">Cash Received (Rs.)</label>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  className="w-full p-2.5 bg-surface-container-lowest border border-outline/10 rounded-lg text-xs font-bold font-mono"
                  value={receivedCash}
                  onChange={(e) => setReceivedCash(e.target.value)}
                />
                {receivedCash && Number(receivedCash) >= balanceDue && balanceDue > 0 && (
                  <div className="flex justify-between items-center bg-emerald-50 text-emerald-800 p-2 rounded-lg border border-emerald-200 mt-2">
                    <span className="font-bold uppercase tracking-wide text-[10px]">Change Due</span>
                    <span className="font-black text-sm">Rs.{(Number(receivedCash) - balanceDue).toFixed(2)}</span>
                  </div>
                )}
                {receivedCash && Number(receivedCash) < balanceDue && balanceDue > 0 && (
                  <div className="flex justify-between items-center bg-error/10 text-error p-2 rounded-lg border border-error/20 mt-2">
                    <span className="font-bold uppercase tracking-wide text-[10px]">Short by</span>
                    <span className="font-black text-sm">Rs.{(balanceDue - Number(receivedCash)).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handlePayBill}
              disabled={busy || upiBusy || cumulativeItems.length === 0 || !selectedCustomer}
              className="w-full py-3 bg-primary text-on-primary font-semibold rounded-xl text-xs hover:bg-primary/95 transition-all shadow disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              <CreditCard size={14} />
              {paymentMethodId === 3 ? 'Pay with Razorpay UPI' : `Pay Bill (Rs.${balanceDue.toFixed(2)})`}
            </button>
          </div>
        </div>



        {paymentHistory.length > 0 && (
          <div className="rounded-2xl border border-outline/10 bg-surface-container-low p-3 text-xs space-y-2 mt-4 mx-6">
            <p className="font-bold uppercase tracking-wider text-outline text-[10px]">Payment Transactions</p>
            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 font-mono">
              {paymentHistory.map((p, idx) => (
                <div key={p.id || idx} className="flex justify-between items-center text-secondary border-b border-outline/5 pb-1">
                  <div>
                    <span className="font-bold text-on-surface uppercase">{p.payment_method_type}</span>
                    <span className="text-[9px] text-outline ml-2">
                      {p.created_at ? new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <span className="font-bold text-emerald-700">Rs.{Number(p.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between border-t border-outline/5 pt-1.5 font-semibold text-on-surface">
              <span>Total Paid</span>
              <span className="text-emerald-800">Rs.{totalPaid.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="border-t border-outline/10 p-6 space-y-3">
          <button
            onClick={() => setShowReceiptModal(true)}
            disabled={currentItems.length === 0}
            className="w-full py-2.5 bg-surface-container border border-outline/20 text-on-surface font-semibold rounded-xl text-xs hover:bg-surface-container-high transition-all flex items-center justify-center gap-2"
          >
            <span>View Bill / Print Receipt</span>
          </button>
          <button
            onClick={handleFinishOrder}
            disabled={busy}
            className="w-full py-3 bg-emerald-600 text-white font-semibold rounded-xl text-xs hover:bg-emerald-700 transition-all shadow disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <span>Unlink & Release Table</span>
          </button>
        </div>
      </div>

      {/* Customer Selection Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4 text-on-surface">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-headline font-bold">
                {isRegisteringNewCust ? 'Register New Customer' : 'Assign Customer Profile'}
              </h3>
              <button 
                onClick={() => {
                  setShowCustomerModal(false);
                  setIsRegisteringNewCust(false);
                }}
                className="text-secondary text-sm font-bold hover:bg-surface-container rounded-full p-1"
              >
                x
              </button>
            </div>

            {!isRegisteringNewCust ? (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline/50" size={16} />
                  <input
                    type="text"
                    placeholder="Search by name or mobile number..."
                    className="w-full rounded-2xl border border-outline/10 bg-surface-container-low py-2.5 pl-10 pr-4 text-xs outline-none focus:border-primary/30"
                    value={customerSearchText}
                    onChange={(e) => handleCustomerSearch(e.target.value)}
                  />
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {customerSearchResults.length > 0 ? (
                    customerSearchResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        disabled={busy}
                        onClick={() => handleAssignCustomer(c.id)}
                        className="w-full text-left p-3 rounded-xl bg-surface-container-low border border-outline/5 hover:border-primary/30 transition-all flex justify-between items-center disabled:opacity-50"
                      >
                        <div>
                          <p className="font-bold text-xs text-on-surface">{c.name}</p>
                          <p className="text-[10px] text-secondary">{c.mobile_number}</p>
                        </div>
                        <span className="text-[9px] font-bold text-primary uppercase">Select</span>
                      </button>
                    ))
                  ) : customerSearchText.trim() ? (
                    <p className="text-center text-xs text-outline italic py-4">No matching customers found.</p>
                  ) : (
                    <p className="text-center text-xs text-outline italic py-4">Type to search existing customers.</p>
                  )}
                </div>

                <div className="border-t pt-4">
                  <button
                    onClick={startRegisteringCustomer}
                    className="w-full py-2.5 bg-primary/10 border border-primary/20 text-primary hover:bg-primary/15 text-xs font-bold rounded-xl transition-all"
                  >
                    Register New Customer Profile
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegisterAndAssignCustomer} className="space-y-3.5 text-left">
                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    pattern="[0-9]{10}"
                    maxLength="10"
                    minLength="10"
                    title="Mobile number must be exactly 10 digits"
                    placeholder="e.g. 9876543210"
                    className="w-full p-2.5 bg-surface-container-low border border-outline/10 rounded-xl text-xs text-on-surface"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    className="w-full p-2.5 bg-surface-container-low border border-outline/10 rounded-xl text-xs text-on-surface"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase mb-1">Email Address</label>
                  <input
                    required
                    type="email"
                    pattern=".*@.*"
                    title="Please include an '@' in the email address."
                    placeholder="e.g. john@example.com"
                    className="w-full p-2.5 bg-surface-container-low border border-outline/10 rounded-xl text-xs text-on-surface"
                    value={newCustEmail}
                    onChange={(e) => setNewCustEmail(e.target.value)}
                  />
                </div>

                <div className="flex gap-3 border-t pt-4">
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 py-2.5 bg-primary text-on-primary font-bold rounded-xl text-xs shadow hover:bg-primary/95 transition-all"
                  >
                    Register & Assign
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRegisteringNewCust(false)}
                    className="flex-1 py-2.5 bg-stone-200 text-stone-700 font-bold rounded-xl text-xs hover:bg-stone-300 transition-all"
                  >
                    Back to Search
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Bill / Thermal Receipt Modal */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Receipt Header */}
            <div className="bg-primary/5 p-4 border-b border-outline/10 flex justify-between items-center text-on-surface">
              <h3 className="font-headline font-bold">Customer Receipt</h3>
              <button 
                onClick={() => setShowReceiptModal(false)}
                className="p-1 hover:bg-surface-container rounded-full text-secondary text-sm font-bold"
              >
                x
              </button>
            </div>

            {/* Receipt Body (Thermal Style) */}
            <div className="flex-1 overflow-y-auto p-6 font-mono text-xs text-stone-800 space-y-4 bg-amber-50/10">
              <div className="text-center space-y-1">
                <h2 className="font-headline text-xl font-bold tracking-tight text-stone-900">CAFE ODOO</h2>
                <p className="text-[10px] text-secondary">PSG iTech Canteen Desk</p>
                <p className="text-[10px] text-secondary">Date: {new Date(currentOrder?.created_at || Date.now()).toLocaleString()}</p>
              </div>

              <div className="border-t border-dashed border-stone-300 pt-3 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Bill No:</span>
                  <span className="font-bold">{currentOrder?.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span>Table:</span>
                  <span className="font-bold">Table {tableId}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="border-t border-dashed border-stone-300 pt-3">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr] font-bold pb-2 border-b border-stone-200">
                  <span>Item</span>
                  <span className="text-center">Qty</span>
                  <span className="text-right">Price</span>
                  <span className="text-right">Total</span>
                </div>
                <div className="divide-y divide-stone-100 py-1">
                  {currentItems.map((item) => (
                    <div key={item.id} className="grid grid-cols-[2fr_1fr_1fr_1fr] py-1.5">
                      <span className="font-sans font-medium text-stone-900">{item.product_name || item.name}</span>
                      <span className="text-center">{Number(item.quantity)}</span>
                      <span className="text-right">{Number(item.unit_price || item.price).toFixed(1)}</span>
                      <span className="text-right font-bold text-stone-900">{(Number(item.quantity) * Number(item.unit_price || item.price)).toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financials */}
              <div className="border-t border-dashed border-stone-300 pt-3 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>Rs.{orderSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax (GST 5%):</span>
                  <span>Rs.{orderTax.toFixed(2)}</span>
                </div>
                {Number(currentOrder?.discount_total || 0) > 0 && (
                  <div className="flex justify-between text-error font-semibold">
                    <span>Discount:</span>
                    <span>-Rs.{Number(currentOrder.discount_total).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-stone-900 border-t border-stone-200 pt-1.5">
                  <span>Grand Total:</span>
                  <span>Rs.{orderTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Payments list */}
              {paymentHistory.length > 0 && (
                <div className="border-t border-dashed border-stone-300 pt-3 space-y-2">
                  <h4 className="font-bold text-[10px] uppercase tracking-wider text-stone-500">Payment Transactions</h4>
                  <div className="space-y-1 text-[10px]">
                    {paymentHistory.map((p, index) => (
                      <div key={p.id || index} className="flex justify-between items-center text-stone-700 bg-stone-50 px-2 py-1 rounded">
                        <span>
                          {index + 1}. {p.payment_method_type.toUpperCase()} 
                          {p.reference_code ? ` (${p.reference_code.substring(0, 8)})` : ''}
                        </span>
                        <span className="font-bold">Rs.{Number(p.amount).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-[11px] font-bold text-emerald-800 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100/50 mt-1">
                    <span>Total Paid:</span>
                    <span>Rs.{totalPaid.toFixed(2)}</span>
                  </div>
                  {balanceDue > 0 && (
                    <div className="flex justify-between text-[11px] font-bold text-amber-800 bg-amber-50/50 p-2 rounded-lg border border-amber-100/50">
                      <span>Balance Due:</span>
                      <span>Rs.{balanceDue.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="text-center pt-4 border-t border-dashed border-stone-300 text-[10px] text-stone-500">
                <p>Thank you for dining with us!</p>
                <p>Cafe Odoo POS Terminal</p>
              </div>
            </div>

            {/* Receipt Footer Actions */}
            <div className="p-4 bg-stone-50 border-t border-stone-200 flex gap-3">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-primary text-on-primary font-bold rounded-xl text-xs shadow hover:bg-primary/95 transition-all"
              >
                Print Receipt
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="flex-1 py-2.5 bg-stone-200 text-stone-700 font-bold rounded-xl text-xs hover:bg-stone-300 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderScreen;
