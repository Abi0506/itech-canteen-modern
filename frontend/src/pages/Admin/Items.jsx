import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Plus, Edit2, Trash2, ShieldAlert } from 'lucide-react';

const Items = () => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [name, setName] = useState('');
  const [catId, setCatId] = useState('');
  const [price, setPrice] = useState('');
  const [cashPrice, setCashPrice] = useState('');
  const [desc, setDesc] = useState('');
  const [qty, setQty] = useState('');

  const loadData = async () => {
    try {
      const res = await api.get('/inventory/products');
      setItems(res.data);
      const catRes = await api.get('/inventory/categories');
      setCategories(catRes.data);
      if (catRes.data.length > 0) setCatId(catRes.data[0].id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name,
        category_id: parseInt(catId),
        price: parseFloat(price),
        uom: "piece",
        tax_percent: 0.0,
        description: desc,
        kds_visible: true
      };
      const response = await api.post('/inventory/products', payload);
      const newProduct = response.data;
      
      const initialQty = parseInt(qty) || 0;
      if (initialQty > 0 && newProduct?.id) {
        await api.put(`/inventory/stock/${newProduct.id}`, { quantity: initialQty, note: "Initial stock" });
      }
      setName('');
      setPrice('');
      setCashPrice('');
      setDesc('');
      setQty('');
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Delete this food item?')) return;
    try {
      await api.delete(`/inventory/products/${itemId}`);
      loadData();
    } catch (err) {
      console.error(err);
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
    <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8 font-body">
      
      {/* Items List */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h1 className="font-headline font-bold text-2xl text-on-surface">Food Items</h1>
          <p className="text-secondary text-sm">Review restaurant menu pricing and stock listings.</p>
        </div>

        <div className="bg-surface-container-low border border-outline/10 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-outline/15 text-outline">
                <th className="p-4 font-bold">Item Name</th>
                <th className="p-4 font-bold">Price</th>
                <th className="p-4 font-bold">Cash Price</th>
                <th className="p-4 font-bold">Quantity</th>
                <th className="p-4 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b border-outline/10 hover:bg-surface-container-high transition-colors bg-surface-container-lowest">
                  <td className="p-4 font-bold text-on-surface">{item.name}</td>
                  <td className="p-4">₹{parseFloat(item.price).toFixed(2)}</td>
                  <td className="p-4 text-secondary">{item.cash_price ? `₹${parseFloat(item.cash_price).toFixed(2)}` : 'N/A'}</td>
                  <td className="p-4 font-semibold">{item.current_stock ?? item.quantity_available ?? 0} units</td>
                  <td className="p-4 flex gap-2">
                    <button onClick={() => handleDeleteItem(item.id)} className="p-1 text-outline hover:text-error">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Item Form */}
      <div>
        <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4">
          <h3 className="font-headline font-bold text-sm text-on-surface">Add Menu Item</h3>

          <form onSubmit={handleAddItem} className="space-y-3">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-outline uppercase tracking-wider">Item Name</label>
              <input
                type="text"
                placeholder="e.g. Filter Coffee"
                className="w-full px-3 py-2 bg-surface-container-lowest border border-outline/20 rounded-lg text-xs"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-outline uppercase tracking-wider">Category</label>
              <select
                className="w-full px-3 py-2 bg-surface-container-lowest border border-outline/20 rounded-lg text-xs"
                value={catId}
                onChange={(e) => setCatId(e.target.value)}
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-outline uppercase tracking-wider">Wallet Price ₹</label>
                <input
                  type="number"
                  placeholder="20.00"
                  step="0.01"
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-outline/20 rounded-lg text-xs"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-outline uppercase tracking-wider">Cash Price ₹</label>
                <input
                  type="number"
                  placeholder="22.00"
                  step="0.01"
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-outline/20 rounded-lg text-xs"
                  value={cashPrice}
                  onChange={(e) => setCashPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-outline uppercase tracking-wider">Stock Qty</label>
              <input
                type="number"
                placeholder="50"
                className="w-full px-3 py-2 bg-surface-container-lowest border border-outline/20 rounded-lg text-xs"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-outline uppercase tracking-wider">Description</label>
              <textarea
                placeholder="Item notes..."
                rows={2}
                className="w-full px-3 py-2 bg-surface-container-lowest border border-outline/20 rounded-lg text-xs"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-primary text-on-primary font-bold rounded-xl hover:bg-on-primary-fixed-variant transition-colors text-xs flex items-center justify-center gap-1.5"
            >
              <Plus size={14} />
              Save Menu Item
            </button>
          </form>
        </div>
      </div>

    </div>
  );
};

export default Items;
