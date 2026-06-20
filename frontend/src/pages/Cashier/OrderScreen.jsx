import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import { Search, ShoppingCart, UserPlus, Sparkles, Receipt, Trash2, ArrowLeft } from 'lucide-react';

const OrderScreen = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialOrderId = searchParams.get('order_id');

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCat, setActiveCat] = useState('all');

  // Customer & Order states
  const [customer, setCustomer] = useState(null);
  const [cart, setCart] = useState([]);
  const [couponCode, setCouponCode] = useState('');
  const [discountTotal, setDiscountTotal] = useState(0);
  const [orderId, setOrderId] = useState(initialOrderId);

  // Modals
  const [showCustModal, setShowCustModal] = useState(false);
  const [cName, setCName] = useState('');
  const [cMobile, setCMobile] = useState('');
  const [cEmail, setCEmail] = useState('');

  // Payment
  const [receivedCash, setReceivedCash] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState(1); // 1 = Cash, 3 = UPI

  const fetchData = async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        api.get('/inventory/products'),
        api.get('/inventory/categories')
      ]);
      setProducts(pRes.data);
      setCategories(cRes.data);
      
      if (initialOrderId) {
        // Fetch existing draft order items
        const ordRes = await api.get(`/cashier/orders`);
        const currentOrder = ordRes.data.find(o => String(o.id) === String(initialOrderId));
        if (currentOrder) {
          setOrderId(currentOrder.id);
          if (currentOrder.customer_id) {
            // Find customer details (stub/placeholder search)
            setCustomer({ id: currentOrder.customer_id, name: 'Registered Guest' });
          }
          const loadedCart = currentOrder.items.map(item => ({
            id: item.product_id,
            name: item.product_name || 'Product',
            price: Number(item.unit_price),
            quantity: Number(item.quantity)
          }));
          setCart(loadedCart);
          setDiscountTotal(Number(currentOrder.discount_total));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [initialOrderId]);

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * 0.05;
  const total = subtotal + tax - discountTotal;

  const handleAddToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { id: product.id, name: product.name, price: Number(product.price), quantity: 1 }];
    });
  };

  const handleUpdateQty = (prodId, delta) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === prodId ? { ...item, quantity: item.quantity + delta } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/cashier/customers', {
        name: cName,
        mobile_number: cMobile,
        email: cEmail || null
      });
      setCustomer(res.data);
      setShowCustModal(false);
    } catch (err) {
      alert('Failed to register customer');
    }
  };

  const handleSaveDraft = async () => {
    const payload = {
      source: 'cashier',
      table_id: Number(tableId),
      customer_id: customer?.id || null,
      items: cart.map((item) => ({
        product_id: item.id,
        quantity: item.quantity
      }))
    };
    try {
      if (orderId) {
        await api.put(`/cashier/orders/${orderId}/items`, payload.items);
      } else {
        const res = await api.post('/cashier/orders', payload);
        setOrderId(res.data.id);
      }
      alert('Order cart updated successfully!');
    } catch (err) {
      alert('Failed to save draft order');
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return alert('Cart is empty!');
    
    // Save draft first to get/update orderId
    const payload = {
      source: 'cashier',
      table_id: Number(tableId),
      customer_id: customer?.id || null,
      items: cart.map((item) => ({
        product_id: item.id,
        quantity: item.quantity
      }))
    };
    
    try {
      let activeId = orderId;
      if (!activeId) {
        const res = await api.post('/cashier/orders', payload);
        activeId = res.data.id;
        setOrderId(activeId);
      } else {
        await api.put(`/cashier/orders/${activeId}/items`, payload.items);
      }

      // Process payment
      const payRes = await api.post(`/cashier/orders/${activeId}/pay-and-send`, {
        payment_method_id: Number(paymentMethodId),
        amount_received: receivedCash ? Number(receivedCash) : total
      });

      alert(`Payment Success! Change due: Rs.${payRes.data.change_due || 0}`);
      navigate('/cashier/tables');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to process checkout');
    }
  };

  const handleApplyCoupon = async () => {
    if (!orderId) {
      alert('Please save the order draft before applying a coupon.');
      return;
    }
    try {
      const res = await api.post('/payments/apply-coupon', {
        order_id: orderId,
        code: couponCode
      });
      setDiscountTotal(res.data.discount_amount);
      alert('Coupon applied successfully!');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to apply coupon');
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = activeCat === 'all' || p.category_id === Number(activeCat);
    return matchesSearch && matchesCat && p.is_active;
  });

  return (
    <div className="min-h-[calc(100vh-57px)] flex flex-col lg:flex-row bg-surface-container font-body">
      
      {/* Catalog Panel (Left/Center) */}
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/cashier/tables')} className="p-2 hover:bg-surface-container-high rounded-full">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-headline font-bold text-xl text-on-surface">Table {tableId} Order</h1>
            <p className="text-secondary text-xs">Register order items and send them directly to the kitchen display.</p>
          </div>
        </div>

        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline/50" size={18} />
            <input
              type="text"
              placeholder="Search food items..."
              className="w-full pl-10 pr-4 py-2.5 bg-surface border border-outline/10 rounded-xl text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveCat('all')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase border transition-all ${
                activeCat === 'all' ? 'bg-primary text-on-primary border-primary' : 'bg-surface text-secondary border-outline/10 hover:bg-surface-container-high'
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase border transition-all`}
                style={{
                  backgroundColor: activeCat === c.id ? c.color_hex : 'white',
                  color: activeCat === c.id ? 'white' : '#5f5e5e',
                  borderColor: activeCat === c.id ? c.color_hex : '#ddc0ba'
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              onClick={() => handleAddToCart(p)}
              className="p-4 bg-surface border border-outline/10 rounded-2xl cursor-pointer hover:border-primary/20 hover:scale-[1.02] transition-all flex flex-col justify-between h-40 shadow-sm"
            >
              <div>
                <h4 className="font-headline font-bold text-sm text-on-surface line-clamp-2">{p.name}</h4>
                {p.description && <p className="text-[10px] text-secondary line-clamp-2 mt-1">{p.description}</p>}
              </div>
              <div className="flex justify-between items-center mt-3 pt-2 border-t border-outline/5">
                <span className="font-bold text-sm text-primary">Rs.{Number(p.price).toFixed(2)}</span>
                <span className="text-[9px] text-outline uppercase">{p.uom}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cart & Checkout Panel (Right Side) */}
      <div className="w-full lg:w-96 bg-surface border-l border-outline/10 p-6 flex flex-col justify-between h-[calc(100vh-57px)] sticky top-[57px]">
        <div className="space-y-6 overflow-y-auto flex-1 pr-1">
          {/* Cart Header */}
          <div className="flex justify-between items-center border-b border-outline/5 pb-3">
            <h3 className="font-headline font-bold text-base flex items-center gap-2 text-on-surface">
              <ShoppingCart size={18} />
              Current Order Cart
            </h3>
            <button
              onClick={() => {
                if (customer) {
                  setCustomer(null);
                } else {
                  setShowCustModal(true);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-outline/10 text-xs font-semibold text-primary rounded-lg hover:bg-surface-container"
            >
              <UserPlus size={14} />
              {customer ? `${customer.name}` : 'Customer'}
            </button>
          </div>

          {/* Cart Items */}
          <div className="space-y-4">
            {cart.map((item) => (
              <div key={item.id} className="flex justify-between items-center text-sm">
                <div>
                  <span className="font-bold text-on-surface">{item.name}</span>
                  <p className="text-[10px] text-secondary">Rs.{item.price.toFixed(2)} each</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => handleUpdateQty(item.id, -1)} className="w-6 h-6 flex items-center justify-center bg-surface-container border rounded font-bold">-</button>
                  <span className="font-bold text-xs">{item.quantity}</span>
                  <button onClick={() => handleUpdateQty(item.id, 1)} className="w-6 h-6 flex items-center justify-center bg-surface-container border rounded font-bold">+</button>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <p className="text-xs text-outline italic text-center py-8">Cart is currently empty. Tap products to insert.</p>
            )}
          </div>

          {/* Coupon / Promos */}
          <div className="border-t border-outline/5 pt-4 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Apply coupon code..."
                className="flex-1 px-3 py-2 bg-surface-container-low border border-outline/10 rounded-lg text-xs"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
              />
              <button
                onClick={handleApplyCoupon}
                className="px-3 py-2 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary/95"
              >
                Apply
              </button>
            </div>
            {discountTotal > 0 && (
              <p className="text-xs text-emerald-600 font-bold">Discount applied: -Rs.{discountTotal.toFixed(2)}</p>
            )}
          </div>
        </div>

        {/* Totals & Payments Footer */}
        <div className="border-t border-outline/10 pt-4 space-y-4 mt-6">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-secondary">
              <span>Subtotal:</span>
              <span>Rs.{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-secondary">
              <span>GST Tax (5%):</span>
              <span>Rs.{tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-secondary">
              <span>Discount:</span>
              <span className="text-emerald-600">-Rs.{discountTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-on-surface border-t border-outline/5 pt-2">
              <span>Total Payable:</span>
              <span>Rs.{total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPaymentMethodId(1)}
              className={`py-2 text-xs font-bold rounded-lg border text-center transition-all ${
                paymentMethodId === 1 ? 'bg-primary text-on-primary border-primary' : 'bg-surface text-secondary border-outline/10'
              }`}
            >
              Cash Payment
            </button>
            <button
              onClick={() => setPaymentMethodId(3)}
              className={`py-2 text-xs font-bold rounded-lg border text-center transition-all ${
                paymentMethodId === 3 ? 'bg-primary text-on-primary border-primary' : 'bg-surface text-secondary border-outline/10'
              }`}
            >
              UPI QR Scan
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
              {receivedCash && Number(receivedCash) >= total && (
                <p className="text-[10px] text-emerald-600 font-bold mt-1">Change due: Rs.{(Number(receivedCash) - total).toFixed(2)}</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={handleSaveDraft}
              className="py-3 bg-surface-container-highest text-on-surface font-semibold rounded-xl text-xs hover:bg-secondary-container transition-all"
            >
              Save Draft
            </button>
            <button
              onClick={handleCheckout}
              className="py-3 bg-primary text-on-primary font-semibold rounded-xl text-xs hover:bg-primary/95 transition-all shadow"
            >
              Pay & Send Kitchen
            </button>
          </div>
        </div>
      </div>

      {/* Customer Registration Modal */}
      {showCustModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline/10 p-6 rounded-2xl w-full max-w-sm space-y-4">
            <h3 className="font-headline font-bold text-lg text-on-surface">Associate Customer</h3>
            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Customer Name</label>
                <input
                  type="text" required
                  className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                  value={cName} onChange={(e) => setCName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Mobile Number (Mandatory)</label>
                <input
                  type="text" required
                  className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                  value={cMobile} onChange={(e) => setCMobile(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Email (Optional)</label>
                <input
                  type="email"
                  className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                  value={cEmail} onChange={(e) => setCEmail(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustModal(false)}
                  className="px-4 py-2 border border-outline/10 rounded-lg text-sm font-semibold hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary/95"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default OrderScreen;
