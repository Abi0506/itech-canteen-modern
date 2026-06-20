import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Plus, Trash2, Edit } from 'lucide-react';

const Items = () => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
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

  const fetchData = async () => {
    try {
      const [iRes, cRes] = await Promise.all([
        api.get('/inventory/products'),
        api.get('/inventory/categories')
      ]);
      setItems(iRes.data);
      setCategories(cRes.data);
      if (cRes.data.length > 0) {
        setCategoryId(cRes.data[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
      image_url: imageUrl || null
    };

    try {
      if (editingId) {
        await api.put(`/inventory/products/${editingId}`, payload);
      } else {
        await api.post('/inventory/products', payload);
      }
      setShowAddModal(false);
      setName('');
      setPrice('');
      setUom('piece');
      setTaxPercent('0.00');
      setKdsVisible(true);
      setDescription('');
      setImageUrl('');
      setEditingId(null);
      fetchData();
    } catch (err) {
      setModalError(err.response?.data?.detail || 'Failed to save product');
    }
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

  const handleDelete = async (id) => {
    if (!window.confirm('Deactivate product?')) return;
    try {
      await api.delete(`/inventory/products/${id}`);
      fetchData();
    } catch (e) {
      alert('Failed to deactivate product');
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-headline font-bold text-2xl text-on-surface">Products & Menu Setup</h1>
          <p className="text-secondary text-sm">Create items, specify unit pricing, taxes, and set visibility parameters for KDS cooking screens.</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setName('');
            setPrice('');
            setUom('piece');
            setTaxPercent('0.00');
            setKdsVisible(true);
            setDescription('');
            setImageUrl('');
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl hover:bg-primary/95 text-sm font-semibold transition-all shadow"
        >
          <Plus size={18} />
          Create Product
        </button>
      </div>

      <div className="overflow-x-auto bg-surface-container-low border border-outline/10 rounded-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline/10 text-outline text-xs uppercase tracking-wider">
              <th className="p-4 font-bold">Product</th>
              <th className="p-4 font-bold">Category</th>
              <th className="p-4 font-bold">Price</th>
              <th className="p-4 font-bold">Unit</th>
              <th className="p-4 font-bold text-center">KDS Screen?</th>
              <th className="p-4 font-bold text-center">Status</th>
              <th className="p-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const cat = categories.find((c) => c.id === i.category_id);
              return (
                <tr key={i.id} className="border-b border-outline/10 text-sm hover:bg-surface-container-high transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {i.image_url ? (
                        <img src={i.image_url} alt={i.name} className="w-10 h-10 object-cover rounded-lg border" />
                      ) : (
                        <div className="w-10 h-10 bg-primary/10 text-primary flex items-center justify-center rounded-lg font-bold">P</div>
                      )}
                      <div>
                        <span className="font-bold text-on-surface">{i.name}</span>
                        {i.description && <p className="text-[10px] text-secondary max-w-xs truncate">{i.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    {cat ? (
                      <span
                        className="px-2.5 py-1 text-xs font-bold uppercase rounded-full"
                        style={{ backgroundColor: `${cat.color_hex}20`, color: cat.color_hex }}
                      >
                        {cat.name}
                      </span>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td className="p-4 font-bold">Rs.{Number(i.price).toFixed(2)}</td>
                  <td className="p-4 text-secondary">{i.uom}</td>
                  <td className="p-4 text-center">
                    {i.kds_visible ? (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800">Yes</span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-surface-variant text-secondary">No</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    {i.is_active ? (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800">Active</span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-error-container text-on-error-container">Inactive</span>
                    )}
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => handleEdit(i)}
                      className="p-2 text-secondary hover:text-primary transition-colors"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(i.id)}
                      className="p-2 text-secondary hover:text-error transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline/10 p-6 rounded-2xl w-full max-w-lg space-y-4">
            <h3 className="font-headline font-bold text-lg text-on-surface">
              {editingId ? 'Edit Product details' : 'Create New Product'}
            </h3>
            {modalError && <p className="text-xs text-error">{modalError}</p>}
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
                    {categories.map((c) => (
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
                  <label className="block text-xs font-semibold text-secondary uppercase mb-1">Tax Percent (%)</label>
                  <input
                    type="number" required step="0.1" min="0" max="100"
                    className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                    value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Image URL (Optional)</label>
                <input
                  type="text"
                  className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                  value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Product Description</label>
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
                <label htmlFor="kds_visible" className="text-sm font-semibold text-on-surface">KDS Visible (send to kitchen display)</label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
