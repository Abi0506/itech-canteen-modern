import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Search, Save, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

const Stock = () => {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [editingQty, setEditingQty] = useState({}); // item_id: new_qty
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const fetchStock = async () => {
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
    fetchStock();
  }, []);

  const handleQtyChange = (itemId, val) => {
    setEditingQty({ ...editingQty, [itemId]: parseInt(val) || 0 });
  };

  const handleSaveStock = async (itemId) => {
    setError('');
    setSuccess('');
    const newQty = editingQty[itemId];
    if (newQty === undefined) return;

    try {
      await api.post(`/cashier/update-stock?item_id=${itemId}&quantity=${newQty}`);
      setSuccess('Stock quantity updated successfully!');
      
      // Update local state
      setItems(items.map(item => item.id === itemId ? { ...item, quantity_available: newQty } : item));
      
      // Clear editing state for this item
      const updatedEditing = { ...editingQty };
      delete updatedEditing[itemId];
      setEditingQty(updatedEditing);
    } catch (err) {
      setError('Failed to update stock. Try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 font-body">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-headline font-bold text-2xl text-on-surface">Canteen Stock Manager</h1>
          <p className="text-secondary text-sm">Update item availability in real-time.</p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" size={16} />
          <input
            type="text"
            placeholder="Search stock item..."
            className="w-full pl-9 pr-4 py-2.5 bg-surface-container-low border border-outline/10 rounded-xl text-xs focus:ring-1 focus:ring-primary/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {success && (
        <div className="toast-animate flex items-start gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 text-xs">
          <CheckCircle size={14} className="mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="toast-animate flex items-start gap-2 p-3 bg-error-container/20 border border-error/10 rounded-xl text-error text-xs">
          <AlertCircle size={14} className="mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-surface-container-low border border-outline/10 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-outline/15 text-outline">
                <th className="p-4 font-bold">Food Item Name</th>
                <th className="p-4 font-bold">Current Stock</th>
                <th className="p-4 font-bold">Adjust Quantity</th>
                <th className="p-4 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={item.id} className="border-b border-outline/10 hover:bg-surface-container-high transition-colors">
                  <td className="p-4 font-bold text-on-surface">{item.name}</td>
                  <td className={`p-4 font-bold ${item.quantity_available > 0 ? 'text-emerald-600' : 'text-error'}`}>
                    {item.quantity_available} units
                  </td>
                  <td className="p-4">
                    <input
                      type="number"
                      className="w-20 px-2 py-1 bg-surface-container-lowest border border-outline/20 rounded-lg text-xs text-center"
                      value={editingQty[item.id] !== undefined ? editingQty[item.id] : item.quantity_available}
                      onChange={(e) => handleQtyChange(item.id, e.target.value)}
                    />
                  </td>
                  <td className="p-4">
                    {editingQty[item.id] !== undefined && editingQty[item.id] !== item.quantity_available && (
                      <button
                        onClick={() => handleSaveStock(item.id)}
                        className="p-2 bg-primary text-on-primary rounded-lg hover:bg-on-primary-fixed-variant transition-colors flex items-center gap-1.5"
                      >
                        <Save size={14} />
                        Save
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan="4" className="text-center py-8 text-outline">No items match search query.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default Stock;
