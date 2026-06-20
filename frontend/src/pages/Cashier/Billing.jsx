import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Search, Plus, Minus, Trash2, Wallet, CreditCard, DollarSign, RefreshCw, X, Receipt, CheckCircle } from 'lucide-react';

const Billing = () => {
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [tabs, setTabs] = useState([
    { id: 1, name: 'Bill Tab 1', cart: [], customer: 'WALKIN', customerDetails: null, paymentMethod: 'cash', cashReceived: '', change: 0 },
    { id: 2, name: 'Bill Tab 2', cart: [], customer: 'WALKIN', customerDetails: null, paymentMethod: 'cash', cashReceived: '', change: 0 },
    { id: 3, name: 'Bill Tab 3', cart: [], customer: 'WALKIN', customerDetails: null, paymentMethod: 'cash', cashReceived: '', change: 0 },
  ]);
  const [activeTabId, setActiveTabId] = useState(1);
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkoutResult, setCheckoutResult] = useState(null);
  const [error, setError] = useState('');

  const fetchItems = async () => {
    try {
      const res = await api.get('/cashier/stock-report');
      setItems(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const activeTab = tabs.find(t => t.id === activeTabId);

  const updateActiveTab = (updates) => {
    setTabs(tabs.map(t => t.id === activeTabId ? { ...t, ...updates } : t));
  };

  const handleAddItem = (item) => {
    const existing = activeTab.cart.find(i => i.id === item.id);
    let newCart;
    if (existing) {
      newCart = activeTab.cart.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
    } else {
      newCart = [...activeTab.cart, { ...item, quantity: 1 }];
    }
    updateActiveTab({ cart: newCart });
  };

  const handleUpdateQty = (itemId, newQty) => {
    let newCart;
    if (newQty <= 0) {
      newCart = activeTab.cart.filter(i => i.id !== itemId);
    } else {
      newCart = activeTab.cart.map(i => i.id === itemId ? { ...i, quantity: newQty } : i);
    }
    updateActiveTab({ cart: newCart });
  };

  const getSubtotal = () => {
    return activeTab.cart.reduce((sum, item) => {
      const price = (activeTab.paymentMethod === 'cash' && item.cash_price !== null) ? parseFloat(item.cash_price) : parseFloat(item.price);
      return sum + (price * item.quantity);
    }, 0);
  };

  const handleSearchUser = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.get(`/cashier/search-user?query=${searchUserQuery}`);
      updateActiveTab({ customer: res.data.roll_no, customerDetails: res.data });
      setSearchUserQuery('');
    } catch (err) {
      setError('Student ID not found');
    }
  };

  const handleCheckout = async () => {
    setError('');
    setCheckoutResult(null);
    if (activeTab.cart.length === 0) {
      setError('Tab cart is empty');
      return;
    }

    try {
      const payload = {
        customer_roll: activeTab.customer,
        payment_method: activeTab.paymentMethod,
        items: activeTab.cart.map(i => ({
          id: i.id,
          name: i.name,
          price: (activeTab.paymentMethod === 'cash' && i.cash_price !== null) ? i.cash_price : i.price,
          quantity: i.quantity,
          category: ''
        })),
        amount_received: activeTab.cashReceived ? parseFloat(activeTab.cashReceived) : 0.00
      };

      const res = await api.post('/cashier/checkout', payload);
      setCheckoutResult(res.data);
      
      // Clear tab cart on success
      updateActiveTab({ cart: [], customer: 'WALKIN', customerDetails: null, cashReceived: '', change: 0 });
      fetchItems(); // refresh stock counts
    } catch (err) {
      setError(err.response?.data?.detail || 'Checkout failed');
    }
  };

  const filteredItems = items.filter(item => 
    item.is_active && item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 font-body">
      
      {/* Tab Control headers */}
      <div className="flex justify-between items-center border-b border-outline/15 pb-2">
        <div className="flex gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTabId(tab.id);
                setCheckoutResult(null);
                setError('');
              }}
              className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${
                activeTabId === tab.id
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface border-outline/10 text-secondary hover:bg-surface-container-high'
              }`}
            >
              {tab.name} {tab.cart.length > 0 && `(${tab.cart.length})`}
            </button>
          ))}
        </div>
        
        <span className="text-[10px] text-outline uppercase font-bold tracking-widest hidden sm:inline">
          Canteen Billing POS v2.0
        </span>
      </div>

      {checkoutResult && (
        <div className="toast-animate flex items-center justify-between gap-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle size={18} />
            <span>
              Bill generated: <strong>#{checkoutResult.bill_number}</strong>. Amount: ₹{checkoutResult.total_amount.toFixed(2)}. 
              {checkoutResult.change_amount > 0 && ` Change to return: ₹${checkoutResult.change_amount.toFixed(2)}.`}
            </span>
          </div>
          <button onClick={() => setCheckoutResult(null)} className="p-1 hover:bg-emerald-500/20 rounded-full">
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <div className="toast-animate flex items-center justify-between gap-4 p-4 rounded-xl bg-error-container/20 border border-error/10 text-error text-xs">
          <span>{error}</span>
          <button onClick={() => setError('')} className="p-1 hover:bg-error-container/20 rounded-full">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Grid: Items Selection list (2 columns on lg) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" size={16} />
            <input
              type="text"
              placeholder="Search canteen item..."
              className="w-full pl-9 pr-4 py-2.5 bg-surface-container-low border border-outline/10 rounded-xl text-xs focus:ring-1 focus:ring-primary/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-1">
            {filteredItems.map(item => (
              <button
                key={item.id}
                onClick={() => handleAddItem(item)}
                disabled={item.quantity_available <= 0}
                className="bg-surface-container-lowest border border-outline/10 p-3 rounded-xl flex flex-col justify-between text-left h-24 transition-all hover:border-primary disabled:opacity-50"
              >
                <div>
                  <h4 className="font-bold text-xs text-on-surface line-clamp-1">{item.name}</h4>
                  <p className="text-[10px] text-primary font-black mt-1">₹{parseFloat(item.price).toFixed(2)}</p>
                </div>
                <div className="flex justify-between items-center w-full mt-2">
                  <span className="text-[9px] text-outline font-bold">Qty: {item.quantity_available}</span>
                  <Plus className="text-primary hover:scale-115 transition-transform" size={14} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Grid: Active Tab Invoice Cart (1 column on lg) */}
        <div className="bg-surface-container-low border border-outline/10 p-5 rounded-2xl space-y-4">
          <h3 className="font-headline font-bold text-sm text-on-surface flex items-center gap-1.5">
            <Receipt size={16} />
            Invoice Cart ({activeTab.cart.length} items)
          </h3>

          {/* Customer Roll Selector */}
          <div className="space-y-2 border-b border-outline/10 pb-4">
            <div className="flex justify-between items-center text-xs">
              <span className="text-outline font-bold">Customer:</span>
              <span className="font-bold text-primary uppercase">{activeTab.customer}</span>
            </div>
            
            <form onSubmit={handleSearchUser} className="flex gap-2">
              <input
                type="text"
                placeholder="Search student ID/Roll..."
                className="w-full px-3 py-1.5 bg-surface-container-lowest border border-outline/20 rounded-lg text-[11px] focus:ring-1 focus:ring-primary/20"
                value={searchUserQuery}
                onChange={(e) => setSearchUserQuery(e.target.value)}
              />
              <button type="submit" className="px-3 bg-surface-container-high text-secondary hover:text-primary font-bold rounded-lg text-xs">
                Search
              </button>
            </form>

            {activeTab.customerDetails && (
              <div className="bg-surface-container-lowest p-2 rounded-lg text-[10px] text-outline font-semibold">
                <p>Balance: <strong className="text-emerald-600 font-black">₹{activeTab.customerDetails.wallet_balance.toFixed(2)}</strong></p>
              </div>
            )}
            
            {activeTab.customer !== 'WALKIN' && (
              <button
                onClick={() => updateActiveTab({ customer: 'WALKIN', customerDetails: null })}
                className="text-[10px] text-error hover:underline flex items-center gap-0.5 mt-1 font-bold"
              >
                Reset to WALKIN
              </button>
            )}
          </div>

          {/* Cart item listing */}
          <div className="max-h-[160px] overflow-y-auto space-y-3 pr-1 border-b border-outline/10 pb-4">
            {activeTab.cart.map(i => {
              const activePrice = (activeTab.paymentMethod === 'cash' && i.cash_price !== null) ? parseFloat(i.cash_price) : parseFloat(i.price);
              return (
                <div key={i.id} className="flex justify-between items-center text-xs">
                  <div>
                    <h5 className="font-bold text-on-surface line-clamp-1">{i.name}</h5>
                    <p className="text-[10px] text-outline">{i.quantity} x ₹{activePrice.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-outline/15 rounded">
                      <button onClick={() => handleUpdateQty(i.id, i.quantity - 1)} className="p-0.5 hover:bg-surface-container-high"><Minus size={10} /></button>
                      <span className="px-2 text-[10px] font-bold">{i.quantity}</span>
                      <button onClick={() => handleUpdateQty(i.id, i.quantity + 1)} className="p-0.5 hover:bg-surface-container-high"><Plus size={10} /></button>
                    </div>
                    <button onClick={() => handleUpdateQty(i.id, 0)} className="text-outline hover:text-error"><Trash2 size={12} /></button>
                  </div>
                </div>
              );
            })}
            
            {activeTab.cart.length === 0 && (
              <p className="text-center text-outline text-[11px] py-4">Cart is empty</p>
            )}
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2 border-b border-outline/10 pb-4">
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider block">Payment</span>
            <div className="grid grid-cols-4 gap-1">
              {['cash', 'upi', 'wallet', 'partial'].map(method => (
                <button
                  key={method}
                  onClick={() => updateActiveTab({ paymentMethod: method })}
                  className={`py-1.5 text-[9px] font-bold uppercase rounded-lg border transition-colors ${
                    activeTab.paymentMethod === method
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-outline/15 hover:bg-surface-container-high text-secondary'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>

            {/* Denomination Calculator for Cash */}
            {activeTab.paymentMethod === 'cash' && (
              <div className="pt-2 space-y-2">
                <input
                  type="number"
                  placeholder="Cash received ₹"
                  className="w-full px-3 py-1.5 bg-surface-container-lowest border border-outline/20 rounded-lg text-xs"
                  value={activeTab.cashReceived}
                  onChange={(e) => {
                    const received = parseFloat(e.target.value) || 0;
                    const change = Math.max(0, received - getSubtotal());
                    updateActiveTab({ cashReceived: e.target.value, change: change });
                  }}
                />
                {activeTab.change > 0 && (
                  <p className="text-[10px] font-bold text-emerald-600">Return Change: ₹{activeTab.change.toFixed(2)}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-between font-headline font-bold text-sm text-on-surface">
            <span>Amount Due</span>
            <span className="text-primary text-base">₹{getSubtotal().toFixed(2)}</span>
          </div>

          <button
            onClick={handleCheckout}
            className="w-full py-3 bg-primary text-on-primary font-bold rounded-xl hover:bg-on-primary-fixed-variant transition-colors text-xs flex items-center justify-center gap-1.5"
          >
            Checkout Invoice
          </button>
        </div>

      </div>

    </div>
  );
};

export default Billing;
