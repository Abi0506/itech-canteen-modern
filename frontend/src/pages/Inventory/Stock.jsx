import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { RefreshCw } from 'lucide-react';

const Stock = () => {
  const [stock, setStock] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [editingItem, setEditingItem] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [modalError, setModalError] = useState('');

  const fetchData = async () => {
    try {
      const [sRes, pRes] = await Promise.all([
        api.get('/inventory/stock'),
        api.get('/inventory/products')
      ]);
      setStock(sRes.data);
      setProducts(pRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    setModalError('');
    try {
      await api.put(`/inventory/stock/${editingItem.product_id}`, {
        quantity: Number(quantity),
        note
      });
      setEditingItem(null);
      setQuantity('');
      setNote('');
      fetchData();
    } catch (err) {
      setModalError(err.response?.data?.detail || 'Failed to adjust stock');
    }
  };

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
        <h1 className="font-headline font-bold text-2xl text-on-surface">Stock Adjustments</h1>
        <p className="text-secondary text-sm">Monitor running inventory quantities, update stock records, and log manual inbound/outbound adjustments.</p>
      </div>

      <div className="overflow-x-auto bg-surface-container-low border border-outline/10 rounded-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline/10 text-outline text-xs uppercase tracking-wider">
              <th className="p-4 font-bold">Product</th>
              <th className="p-4 font-bold">SKU</th>
              <th className="p-4 font-bold text-center">Current Stock</th>
              <th className="p-4 font-bold text-center">Reorder Trigger</th>
              <th className="p-4 font-bold text-right">Adjustment</th>
            </tr>
          </thead>
          <tbody>
            {stock.map((s) => {
              const prod = products.find((p) => p.id === s.product_id);
              const isLow = Number(s.current_stock) <= Number(s.reorder_level);
              return (
                <tr key={s.id} className="border-b border-outline/10 text-sm hover:bg-surface-container-high transition-colors">
                  <td className="p-4 font-bold text-on-surface">{prod ? prod.name : 'Unknown Product'}</td>
                  <td className="p-4 text-secondary font-mono">{s.sku}</td>
                  <td className="p-4 text-center">
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                      isLow ? 'bg-error-container text-on-error-container border border-error/10' : 'bg-primary-fixed text-on-primary-fixed-variant'
                    }`}>
                      {Number(s.current_stock)} {s.unit}
                    </span>
                  </td>
                  <td className="p-4 text-center text-secondary">{Number(s.reorder_level)} {s.unit}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => setEditingItem(s)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-outline/10 rounded-lg text-xs font-semibold hover:bg-surface-container text-primary transition-all"
                    >
                      <RefreshCw size={14} />
                      Adjust
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Adjustment Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline/10 p-6 rounded-2xl w-full max-w-md space-y-4">
            <h3 className="font-headline font-bold text-lg text-on-surface">Adjust Inventory Stock</h3>
            <p className="text-xs text-secondary">
              Product: <strong>{products.find((p) => p.id === editingItem.product_id)?.name}</strong>
            </p>
            {modalError && <p className="text-xs text-error">{modalError}</p>}
            <form onSubmit={handleAdjustStock} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">
                  Adjustment Quantity (use positive to add, negative to deduct)
                </label>
                <input
                  type="number" required step="0.01"
                  placeholder="e.g. 50 or -15"
                  className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                  value={quantity} onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Adjustment Note / Reason</label>
                <input
                  type="text" required
                  placeholder="e.g. Restocked shelf or wastage"
                  className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                  value={note} onChange={(e) => setNote(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 border border-outline/10 rounded-lg text-sm font-semibold hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary/95"
                >
                  Apply Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Stock;
