import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { Eye, Edit } from 'lucide-react';

const OrdersList = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchOrders = async () => {
    try {
      const res = await api.get('/cashier/orders');
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
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 font-body">
      <div>
        <h1 className="font-headline font-bold text-2xl text-on-surface">Active Bills</h1>
        <p className="text-secondary text-sm">Bills created from the cashier table flow.</p>
      </div>

      <div className="overflow-x-auto bg-surface-container-low border border-outline/10 rounded-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline/10 text-outline text-xs uppercase tracking-wider">
              <th className="p-4 font-bold">Order Number</th>
              <th className="p-4 font-bold">Table</th>
              <th className="p-4 font-bold">Source</th>
              <th className="p-4 font-bold">Total</th>
              <th className="p-4 font-bold text-center">Payment Status</th>
              <th className="p-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-outline/10 text-sm hover:bg-surface-container-high transition-colors">
                <td className="p-4 font-bold text-on-surface">{o.order_number}</td>
                <td className="p-4">Table {o.table_id || 'N/A'}</td>
                <td className="p-4 uppercase text-xs font-semibold text-secondary">{o.source}</td>
                <td className="p-4 font-bold">Rs.{Number(o.total).toFixed(2)}</td>
                <td className="p-4 text-center">
                  <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full uppercase border ${
                    o.status === 'paid' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                    o.status === 'sent_to_kitchen' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                    'bg-surface-variant text-secondary border-outline/10'
                  }`}>
                    {o.status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  {o.status === 'draft' ? (
                    <button
                      onClick={() => navigate(`/cashier/order/${o.table_id}?order_id=${o.id}`)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary/95"
                    >
                      <Edit size={14} />
                      Checkout
                    </button>
                  ) : (
                    <span className="text-outline text-xs italic">Finalized</span>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan="6" className="p-8 text-center text-outline italic text-xs">No active bills found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrdersList;
