import React, { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import { Plus, Edit, Search, ToggleLeft, ToggleRight, Package } from 'lucide-react';

const Items = () => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [catFilter, setCatFilter] = useState('all');

  // Modal forms
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [uom, setUom] = useState('piece');
  const [taxPercent, setTaxPercent] = useState('0.00');
  const [kdsVisible, setKdsVisible] = useState(true);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [modalError, setModalError] = useState('');
  const [togglingId, setTogglingId] = useState(null);

  const fetchData = async () => {
    try {
      const [iRes, cRes] = await Promise.all([
        api.get('/inventory/products', { params: { include_inactive: true } }),
        api.get('/inventory/categories', { params: { include_inactive: true } }),
      ]);
      setItems(iRes.data);
      setCategories(cRes.data);
      if (!categoryId && cRes.data.length > 0) setCategoryId(cRes.data[0].id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && item.is_active) ||
        (statusFilter === 'inactive' && !item.is_active);
      const matchesCat = catFilter === 'all' || item.category_id === Number(catFilter);
      return matchesSearch && matchesStatus && matchesCat;
    });
  }, [items, searchQuery, statusFilter, catFilter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    const payload = {
      name,
      price: Number(price),
      category_id: Number(categoryId),
      uom,
      tax_percent: Number(taxPercent),
      kds_visible: kdsVisible,
      description,
      image_url: imageUrl || null,
    };
    try {
      if (editingId) {
        await api.put(`/inventory/products/${editingId}`, payload);
      } else {
        await api.post('/inventory/products', payload);
      }
      setShowAddModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      setModalError(err.response?.data?.detail || 'Failed to save product');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPrice('');
    setUom('piece');
    setTaxPercent('0.00');
    setKdsVisible(true);
    setDescription('');
    setImageUrl('');
    setModalError('');
  };

  const handleEdit = (prod) => {
    setEditingId(prod.id);
    setName(prod.name);
    setPrice(prod.price);
    setCategoryId(prod.category_id);
    setUom(prod.uom);
    setTaxPercent(prod.tax_percent);
    setKdsVisible(prod.kds_visible);
    setDescription(prod.description || '');
    setImageUrl(prod.image_url || '');
    setShowAddModal(true);
  };

  const handleToggleStatus = async (id) => {
    setTogglingId(id);
    try {
      await api.patch(`/inventory/products/${id}/status`);
      await fetchData();
    } catch (e) {
      alert('Failed to update product status');
    } finally {
      setTogglingId(null);
    }
  };

  const StatusPill = ({ active }) =>
    active ? (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Active
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-700">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        Inactive
      </span>
    );

  const StockBadge = ({ stock }) => {
    const s = Number(stock || 0);
    if (s <= 0)
      return <span className="px-2 py-0.5 text-xs font-bold rounded bg-red-100 text-red-700">Out of stock</span>;
    if (s <= 10)
      return <span className="px-2 py-0.5 text-xs font-bold rounded bg-amber-100 text-amber-700">{s} left</span>;
    return <span className="px-2 py-0.5 text-xs font-bold rounded bg-surface-container text-secondary">{s}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 font-body">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="font-headline font-bold text-2xl text-on-surface">Products &amp; Menu Setup</h1>
          <p className="text-secondary text-sm mt-0.5">
            Manage all menu items — toggle active/inactive to control what's orderable everywhere.
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl hover:bg-primary/95 text-sm font-semibold transition-all shadow shrink-0"
        >
          <Plus size={18} />
          Create Product
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline/50" size={16} />
          <input
            type="text"
            placeholder="Search products..."
            className="w-full pl-9 pr-4 py-2.5 bg-surface-container-low border border-outline/10 rounded-xl text-sm outline-none focus:border-primary/40"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {/* Category filter */}
        <select
          className="px-3 py-2.5 bg-surface-container-low border border-outline/10 rounded-xl text-sm text-secondary outline-none focus:border-primary/40 min-w-[160px]"
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {/* Status filter */}
        <div className="flex rounded-xl border border-outline/10 overflow-hidden bg-surface-container-low text-sm font-semibold shrink-0">
          {['all', 'active', 'inactive'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2.5 capitalize transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-on-primary'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-3 text-xs text-secondary">
        <span>{filteredItems.length} of {items.length} products</span>
        <span>·</span>
        <span className="text-emerald-600 font-semibold">{items.filter(i => i.is_active).length} active</span>
        <span>·</span>
        <span className="text-red-500 font-semibold">{items.filter(i => !i.is_active).length} inactive</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-surface-container-low border border-outline/10 rounded-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline/10 text-outline text-xs uppercase tracking-wider">
              <th className="p-4 font-bold">Product</th>
              <th className="p-4 font-bold">Category</th>
              <th className="p-4 font-bold">Price</th>
              <th className="p-4 font-bold">Unit</th>
              <th className="p-4 font-bold text-center">Stock</th>
              <th className="p-4 font-bold text-center">KDS?</th>
              <th className="p-4 font-bold text-center">Status</th>
              <th className="p-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-10 text-center text-secondary text-sm">
                  <Package className="mx-auto mb-2 text-outline" size={32} />
                  No products match your filters.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const cat = categories.find((c) => c.id === item.category_id);
                return (
                  <tr
                    key={item.id}
                    className={`border-b border-outline/10 text-sm transition-colors ${
                      item.is_active
                        ? 'hover:bg-surface-container-high'
                        : 'bg-surface-container/40 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-10 h-10 object-cover rounded-lg border" />
                        ) : (
                          <div className="w-10 h-10 bg-primary/10 text-primary flex items-center justify-center rounded-lg font-bold text-lg">
                            {item.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <span className="font-bold text-on-surface">{item.name}</span>
                          {item.description && (
                            <p className="text-[10px] text-secondary max-w-xs truncate">{item.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      {cat ? (
                        <span
                          className="px-2.5 py-1 text-xs font-bold uppercase rounded-full"
                          style={{ backgroundColor: `${cat.color_hex}25`, color: cat.color_hex }}
                        >
                          {cat.name}
                        </span>
                      ) : 'N/A'}
                    </td>
                    <td className="p-4 font-bold">Rs.{Number(item.price).toFixed(2)}</td>
                    <td className="p-4 text-secondary">{item.uom}</td>
                    <td className="p-4 text-center">
                      <StockBadge stock={item.current_stock} />
                    </td>
                    <td className="p-4 text-center">
                      {item.kds_visible ? (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800">Yes</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-surface-variant text-secondary">No</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <StatusPill active={item.is_active} />
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(item)}
                          title="Edit"
                          className="p-2 text-secondary hover:text-primary transition-colors rounded-lg hover:bg-surface-container-high"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(item.id)}
                          disabled={togglingId === item.id}
                          title={item.is_active ? 'Deactivate' : 'Activate'}
                          className={`p-2 transition-colors rounded-lg hover:bg-surface-container-high ${
                            item.is_active ? 'text-emerald-600 hover:text-red-500' : 'text-red-400 hover:text-emerald-600'
                          }`}
                        >
                          {item.is_active ? (
                            <ToggleRight size={20} />
                          ) : (
                            <ToggleLeft size={20} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline/10 p-6 rounded-2xl w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-headline font-bold text-lg text-on-surface">
              {editingId ? 'Edit Product' : 'Create New Product'}
            </h3>
            {modalError && <p className="text-xs text-error bg-error-container/20 p-3 rounded-lg">{modalError}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary uppercase mb-1">Product Name</label>
                  <input
                    type="text" required
                    className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                    value={name} onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary uppercase mb-1">Category</label>
                  <select
                    className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                    value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                  >
                    {categories.filter(c => c.is_active).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary uppercase mb-1">Price (Rs.)</label>
                  <input
                    type="number" required step="0.01" min="0"
                    className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                    value={price} onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary uppercase mb-1">Unit (UOM)</label>
                  <input
                    type="text" required
                    className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                    value={uom} onChange={(e) => setUom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary uppercase mb-1">Tax %</label>
                  <input
                    type="number" required step="0.1" min="0" max="100"
                    className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                    value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Image URL (optional)</label>
                <input
                  type="text"
                  className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                  value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Description</label>
                <textarea
                  className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm h-20"
                  value={description} onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox" id="kds_visible"
                  className="h-5 w-5 rounded border-outline/30 text-primary"
                  checked={kdsVisible} onChange={(e) => setKdsVisible(e.target.checked)}
                />
                <label htmlFor="kds_visible" className="text-sm font-semibold text-on-surface">
                  KDS Visible (show on kitchen display)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="px-4 py-2 border border-outline/10 rounded-lg text-sm font-semibold hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary/95"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Items;
