import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Calendar, Receipt, X, Check, Barcode } from 'lucide-react';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const res = await api.get('/users/orders');
      setOrders(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="font-headline font-bold text-2xl text-on-surface">Order History</h1>
        <p className="text-secondary text-sm">View receipts, print keys, and collect barcodes.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {orders.map(order => (
          <div
            key={order.id}
            onClick={() => setSelectedOrder(order)}
            className="bg-surface-container-lowest border border-outline/10 p-5 rounded-2xl flex items-center justify-between gap-6 hover:shadow-md cursor-pointer transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="bg-primary/5 text-primary p-3 rounded-full">
                <Receipt size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="font-headline font-bold text-primary text-xs uppercase tracking-widest">
                  #{order.bill_number}
                </h3>
                <p className="text-on-surface text-sm font-bold">
                  ₹{parseFloat(order.total_amount).toFixed(2)}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-outline">
                  <Calendar size={10} />
                  {new Date(order.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                order.payment_status === 'completed'
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-yellow-500/10 text-yellow-600'
              }`}>
                {order.payment_status}
              </span>
              <span className="material-symbols-outlined text-outline">chevron_right</span>
            </div>

          </div>
        ))}

        {orders.length === 0 && (
          <p className="text-center py-12 text-outline text-sm">You haven't placed any orders yet.</p>
        )}
      </div>

      {/* Selected Order Receipt Drawer / Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl w-full max-w-md p-6 border border-outline/10 shadow-xl space-y-6 relative">
            
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute top-4 right-4 p-2 text-outline hover:bg-surface-container-high rounded-full transition-colors"
            >
              <X size={18} />
            </button>

            <div className="text-center space-y-1 pt-2">
              <h2 className="font-headline font-black text-lg text-on-surface">Order Details</h2>
              <p className="text-[10px] text-outline uppercase font-bold tracking-widest">#{selectedOrder.bill_number}</p>
            </div>

            {/* Items Breakdown list */}
            <div className="border-y border-outline/10 py-4 max-h-[160px] overflow-y-auto space-y-3">
              {Object.entries(selectedOrder.items || {}).map(([name, details]) => (
                <div key={name} className="flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-on-surface">{name}</p>
                    <p className="text-secondary text-[10px]">{details.quantity} x ₹{parseFloat(details.rate).toFixed(2)}</p>
                  </div>
                  <span className="font-bold text-on-surface">₹{details.total.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between font-headline font-bold text-base text-on-surface">
              <span>Total Amount</span>
              <span className="text-primary">₹{parseFloat(selectedOrder.total_amount).toFixed(2)}</span>
            </div>

            {/* CSS-generated barcode representing the bill number */}
            {selectedOrder.payment_status === 'completed' && (
              <div className="bg-surface-container-low border border-outline/10 p-5 rounded-2xl flex flex-col items-center gap-3">
                <p className="text-[10px] text-outline uppercase font-bold tracking-widest">Billing Barcode</p>
                <div className="flex items-end justify-center h-10 w-full max-w-[200px] gap-[1px]">
                  {/* Generate pseudo barcode patterns based on bill number hash */}
                  {selectedOrder.bill_number.split('').map((char, index) => {
                    const height = 24 + ((char.charCodeAt(0) * (index + 1)) % 16);
                    const width = (index % 3 === 0) ? 'w-[3px]' : 'w-[1.5px]';
                    return (
                      <div key={index} className={`bg-on-surface ${width}`} style={{ height: `${height}px` }}></div>
                    );
                  })}
                </div>
                <span className="font-mono text-xs text-on-surface tracking-wider font-bold">
                  {selectedOrder.bill_number}
                </span>
              </div>
            )}

            <div className="text-center">
              <p className="text-[10px] text-outline">
                Receipt generated on {new Date(selectedOrder.created_at).toLocaleString()}
              </p>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Orders;
