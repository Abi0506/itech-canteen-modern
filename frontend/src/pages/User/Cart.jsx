import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { Trash2, ShoppingBag, Plus, Minus, CreditCard, Wallet, ChevronLeft, CheckCircle } from 'lucide-react';

const Cart = () => {
  const { cart, updateQuantity, removeFromCart, getCartTotal, clearCart } = useCart();
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  
  const [paymentMethod, setPaymentMethod] = useState('wallet');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(null);

  const handleCheckout = async () => {
    setError('');
    setLoading(true);
    try {
      const itemsPayload = cart.map(item => ({
        food_item_id: item.id,
        quantity: item.quantity
      }));
      
      const res = await api.post('/users/checkout', {
        items: itemsPayload,
        payment_method: paymentMethod
      });
      
      if (paymentMethod === 'wallet') {
        setOrderSuccess(res.data);
        clearCart();
        refreshProfile();
      } else if (paymentMethod === 'razorpay') {
        // Mock Razorpay payment cycle
        const { order_id, razorpay_order_id } = res.data;
        
        // Simulating Razorpay success verify
        const verifyRes = await api.post('/users/razorpay/verify', {
          order_id: order_id,
          payment_id: `pay_${Math.random().toString(36).substring(7)}`,
          signature: 'mock_sig_verification'
        });
        
        setOrderSuccess({
          bill_number: verifyRes.data.bill_number,
          order_id: order_id
        });
        clearCart();
        refreshProfile();
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Checkout failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (orderSuccess) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="mx-auto w-16 h-16 flex items-center justify-center bg-emerald-500/10 text-emerald-600 rounded-full mb-6">
          <CheckCircle size={40} />
        </div>
        <h1 className="font-headline font-bold text-2xl mb-2 text-on-surface">Order Placed Successfully!</h1>
        <p className="text-secondary text-sm mb-6">
          Your order number is <strong className="text-primary">#{orderSuccess.bill_number}</strong>. Collect your meals by showing the barcode at the canteen counter.
        </p>
        <div className="space-y-3">
          <Link
            to="/orders"
            className="block w-full py-3 bg-primary text-on-primary font-bold rounded-xl hover:bg-on-primary-fixed-variant transition-colors"
          >
            View Order Receipt
          </Link>
          <Link
            to="/dashboard"
            className="block w-full py-3 bg-surface-container-high text-secondary font-bold rounded-xl hover:text-primary transition-colors"
          >
            Continue Ordering
          </Link>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center text-outline">
        <ShoppingBag className="mx-auto mb-4 opacity-30" size={48} />
        <h2 className="font-headline font-bold text-lg text-on-surface mb-2">Your cart is empty</h2>
        <p className="text-sm mb-6">Explore our menu and add items to your cart.</p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary font-bold rounded-xl hover:bg-on-primary-fixed-variant transition-colors"
        >
          <ChevronLeft size={16} />
          Back to Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Link to="/dashboard" className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="font-headline font-bold text-2xl text-on-surface">Your Shopping Cart</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Cart Items List */}
        <div className="md:col-span-2 space-y-4">
          {cart.map(item => (
            <div key={item.id} className="bg-surface-container-lowest border border-outline/10 p-4 rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-outline/30">
                    <span className="material-symbols-outlined text-xl">restaurant</span>
                  </div>
                )}
                <div>
                  <h3 className="font-headline font-bold text-on-surface text-sm">{item.name}</h3>
                  <p className="text-xs text-primary font-bold">₹{parseFloat(item.price).toFixed(2)}</p>
                </div>
              </div>

              {/* Quantity Selector */}
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-outline/20 rounded-lg overflow-hidden">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="p-1.5 hover:bg-surface-container-high text-secondary"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="px-3 text-xs font-bold text-on-surface">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="p-1.5 hover:bg-surface-container-high text-secondary"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <button
                  onClick={() => removeFromCart(item.id)}
                  className="p-2 text-outline hover:text-error hover:bg-error/5 rounded-full transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>

            </div>
          ))}
        </div>

        {/* Order Summary Pane */}
        <div className="space-y-6">
          <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4">
            <h2 className="font-headline font-bold text-base text-on-surface">Order Summary</h2>
            
            <div className="space-y-2 text-sm border-b border-outline/10 pb-4">
              <div className="flex justify-between text-secondary">
                <span>Subtotal</span>
                <span>₹{getCartTotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-secondary">
                <span>Taxes & Fees</span>
                <span>₹0.00</span>
              </div>
            </div>

            <div className="flex justify-between font-headline font-bold text-base text-on-surface">
              <span>Total</span>
              <span className="text-primary">₹{getCartTotal().toFixed(2)}</span>
            </div>

            {/* Payment Method Picker */}
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-bold text-outline uppercase tracking-wider">Payment Method</label>
              
              <button
                onClick={() => setPaymentMethod('wallet')}
                className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-colors ${
                  paymentMethod === 'wallet'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-outline/20 hover:bg-surface-container-high text-secondary'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Wallet size={16} />
                  <span className="text-xs font-bold">Wallet Balance</span>
                </div>
                <span className="text-xs font-bold">₹{user.wallet_balance.toFixed(2)}</span>
              </button>

              <button
                onClick={() => setPaymentMethod('razorpay')}
                className={`w-full p-3 rounded-xl border text-left flex items-center gap-2 transition-colors ${
                  paymentMethod === 'razorpay'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-outline/20 hover:bg-surface-container-high text-secondary'
                }`}
              >
                <CreditCard size={16} />
                <span className="text-xs font-bold">Razorpay Online</span>
              </button>
            </div>

            {error && <p className="text-xs text-error font-medium text-center">{error}</p>}

            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full py-3 bg-primary text-on-primary font-bold rounded-xl hover:bg-on-primary-fixed-variant disabled:bg-outline/20 transition-all flex items-center justify-center gap-2"
            >
              {loading ? 'Processing...' : 'Place Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
