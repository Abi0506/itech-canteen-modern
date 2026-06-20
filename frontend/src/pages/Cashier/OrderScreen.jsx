import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../utils/api';
import { ArrowLeft, Search, ShoppingCart, Send, CreditCard } from 'lucide-react';
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
  const [receivedCash, setReceivedCash] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState(1);
  const [upiBusy, setUpiBusy] = useState(false);

  const loadData = async () => {
    setError('');
    try {
      const [productsRes, categoriesRes, orderRes] = await Promise.allSettled([
        api.get('/inventory/products'),
        api.get('/inventory/categories'),
        api.get(`/cashier/tables/${tableId}/current-order`),
      ]);

      if (productsRes.status === 'fulfilled') {
        setProducts(productsRes.value.data || []);
      } else {
        throw productsRes.reason;
      }

      if (categoriesRes.status === 'fulfilled') {
        setCategories(categoriesRes.value.data || []);
      } else {
        throw categoriesRes.reason;
      }

      setCurrentOrder(orderRes.status === 'fulfilled' ? (orderRes.value.data || null) : null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load cashier data.');
      setCurrentOrder(null);
    }
  };

  useEffect(() => {
    loadData();
  }, [tableId]);

  const currentItems = useMemo(() => groupOrderItems(currentOrder?.items || []), [currentOrder]);
  const sentItems = currentOrder?.status === 'sent_to_kitchen' ? currentItems : [];
  const cartSubtotal = cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
  const orderSubtotal = Number(
    currentOrder?.subtotal ?? currentItems.reduce((sum, item) => sum + (Number(item.unit_price || item.rate || item.price || 0) * Number(item.quantity || 0)), 0)
  );
  const orderTax = Number(currentOrder?.tax_total ?? (orderSubtotal * 0.05));
  const orderTotal = Number(currentOrder?.total ?? (orderSubtotal + orderTax));

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

  const handleDraftAndSend = async () => {
    if (cart.length === 0) {
      setError('Cart is empty.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        source: 'cashier',
        table_id: Number(tableId),
        items: cart.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
        })),
      };

      const res = await api.post('/cashier/orders', payload);

      setCart([]);
      setMessage('Items sent to the chef.');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send items to the chef.');
    } finally {
      setBusy(false);
    }
  };

  const handlePayBill = async () => {
    if (!currentOrder?.id) {
      setError('No active bill found for this table.');
      return;
    }
    if (currentOrder.status !== 'sent_to_kitchen') {
      setError('Send the items to the chef before paying.');
      return;
    }
    if (cart.length > 0) {
      setError('Please send the new items to the chef before paying.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const paymentMethodPayload = {
        payment_method_id: Number(paymentMethodId),
        amount_received: paymentMethodId === 1 && receivedCash ? Number(receivedCash) : orderTotal,
      };

      const res = await api.post(`/cashier/orders/${currentOrder.id}/pay-and-send`, paymentMethodPayload);

      if (paymentMethodId === 3 && res.data?.payment_provider === 'razorpay') {
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
              const verifyRes = await api.post(`/cashier/orders/${currentOrder.id}/razorpay/verify`, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              setMessage(`UPI payment completed via Razorpay. Change due: Rs.${Number(verifyRes.data.change_due || 0).toFixed(2)}`);
              navigate('/cashier/tables');
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

      setMessage(`Payment completed. Change due: Rs.${Number(res.data.change_due || 0).toFixed(2)}`);
      navigate('/cashier/tables');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to complete payment.');
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

        {/* {message && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-error/10 bg-error-container/20 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )} */}

        <div className="rounded-3xl border border-outline/10 bg-surface-container-low p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Menu</p>
              <h2 className="font-headline text-lg font-bold text-on-surface">Add new items</h2>
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

           <div className="rounded-2xl border border-outline/10 bg-surface-container-lowest p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-secondary">
              <span>Temporary cart</span>
              <span>{cart.length} item(s)</span>
            </div>
            {cart.length === 0 ? (
              <p className="py-3 text-center text-xs text-outline">Selected items will appear here.</p>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-outline/10 bg-surface-container-low p-3 text-sm">
                    <div>
                      <p className="font-semibold text-on-surface">{item.name}</p>
                      <p className="text-[10px] text-outline">Rs.{item.price.toFixed(2)} each</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.id, -1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-outline/10 bg-surface-container text-sm font-bold"
                      >
                        -
                      </button>
                      <span className="min-w-5 text-center text-xs font-bold">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.id, 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-outline/10 bg-surface-container text-sm font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-outline/10 bg-surface-container-lowest p-3 text-xs space-y-1">
            <div className="flex justify-between text-secondary">
              <span>Subtotal</span>
              <span>Rs.{cartSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-on-surface border-t border-outline/5 pt-2">
              <span>Total</span>
              <span>Rs.{cartSubtotal.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={handleDraftAndSend}
            disabled={cart.length === 0}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-semibold text-on-primary shadow transition-all hover:bg-primary/95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={14} />
            Add New Items and Send
          </button>
        </div>
      </div>

      <div className="w-full lg:w-96 bg-surface border-l border-outline/10 p-6 flex flex-col justify-between h-[calc(100vh-57px)] sticky top-[57px]">
        <div className="space-y-5 overflow-y-auto flex-1 pr-1">
          <div className="flex justify-between items-center border-b border-outline/5 pb-3">
            <h3 className="font-headline font-bold text-base flex items-center gap-2 text-on-surface">
              <ShoppingCart size={18} />
              Sent to Chef
            </h3>
            <span className="text-xs font-semibold text-secondary">{sentItems.length} item(s)</span>
          </div>

          <div className="space-y-3">
            {sentItems.length === 0 ? (
              <p className="text-xs text-outline italic text-center py-8">Items sent to the chef will appear here.</p>
            ) : (
              sentItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-outline/10 bg-surface-container-lowest p-3 text-sm">
                  <div>
                    <span className="font-bold text-on-surface">{item.product_name || item.name}</span>
                    <p className="text-[10px] text-secondary">Rs.{Number(item.unit_price).toFixed(2)} each</p>
                  </div>
                  <span className="font-bold text-on-surface">x{Number(item.quantity)}</span>
                </div>
              ))
            )}
          </div>

          <div className="rounded-2xl border border-outline/10 bg-surface-container-low p-3 text-xs space-y-2">
            <div className="flex justify-between text-secondary">
              <span>Subtotal</span>
              <span>Rs.{orderSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-secondary">
              <span>Tax 5%</span>
              <span>Rs.{orderTax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-outline/5 pt-2 text-sm font-bold text-on-surface">
              <span>Total amount</span>
              <span>Rs.{orderTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="border-t border-outline/10 pt-4 space-y-3 mt-6">
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
            <div>
              <label className="block text-[10px] font-semibold text-secondary uppercase mb-1">Cash Received (Rs.)</label>
              <input
                type="number"
                placeholder="e.g. 500"
                className="w-full p-2.5 bg-surface-container-low border border-outline/10 rounded-lg text-xs"
                value={receivedCash}
                onChange={(e) => setReceivedCash(e.target.value)}
              />
            </div>
          )}

          <button
            onClick={handlePayBill}
            disabled={busy || upiBusy || currentItems.length === 0}
            className="w-full py-3 bg-primary text-on-primary font-semibold rounded-xl text-xs hover:bg-primary/95 transition-all shadow disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <CreditCard size={14} />
            {paymentMethodId === 3 ? 'Pay with Razorpay UPI' : 'Pay Bill'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderScreen;
