import React, { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import { Plus, Edit, ToggleLeft, ToggleRight, Tag } from 'lucide-react';

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [togglingId, setTogglingId] = useState(null);

  // Modal forms
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [colorHex, setColorHex] = useState('#CCCCCC');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [modalError, setModalError] = useState('');

  const fetchCats = async () => {
    try {
      const res = await api.get('/inventory/categories', { params: { include_inactive: true } });
      setCategories(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCats(); }, []);

  const filtered = useMemo(() => {
    return categories.filter((c) => {
      if (statusFilter === 'active') return c.is_active;
      if (statusFilter === 'inactive') return !c.is_active;
      return true;
    });
  }, [categories, statusFilter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    const payload = { name, color_hex: colorHex, display_order: Number(displayOrder) };
    try {
      if (editingId) {
        await api.put(`/inventory/categories/${editingId}`, payload);
      } else {
        await api.post('/inventory/categories', payload);
      }
      setShowModal(false);
      resetForm();
      fetchCats();
    } catch (err) {
      setModalError(err.response?.data?.detail || 'Failed to save category');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setColorHex('#CCCCCC');
    setDisplayOrder(0);
    setModalError('');
  };

  const handleEdit = (cat) => {
    setEditingId(cat.id);
    setName(cat.name);
    setColorHex(cat.color_hex);
    setDisplayOrder(cat.display_order);
    setShowModal(true);
  };

  const handleToggleStatus = async (id) => {
    setTogglingId(id);
    try {
      await api.patch(`/inventory/categories/${id}/status`);
      await fetchCats();
    } catch (e) {
      alert('Failed to update category status');
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 font-body">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="font-headline font-bold text-2xl text-on-surface">Categories Setup</h1>
          <p className="text-secondary text-sm mt-0.5">
            Organize menu products with color-coded categories. Inactive categories hide all their products from ordering.
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl hover:bg-primary/95 text-sm font-semibold transition-all shadow shrink-0"
        >
          <Plus size={18} />
          Add Category
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex gap-2 text-xs text-secondary">
          <span className="text-emerald-600 font-semibold">{categories.filter(c => c.is_active).length} active</span>
          <span>·</span>
          <span className="text-red-500 font-semibold">{categories.filter(c => !c.is_active).length} inactive</span>
        </div>
        <div className="flex rounded-xl border border-outline/10 overflow-hidden bg-surface-container-low text-sm font-semibold">
          {['all', 'active', 'inactive'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2.5 capitalize transition-colors ${
                statusFilter === s ? 'bg-primary text-on-primary' : 'text-secondary hover:text-primary'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-surface-container-low border border-outline/10 rounded-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline/10 text-outline text-xs uppercase tracking-wider">
              <th className="p-4 font-bold">Category Name</th>
              <th className="p-4 font-bold text-center">Color Badge</th>
              <th className="p-4 font-bold text-center">Sort Order</th>
              <th className="p-4 font-bold text-center">Products Affected</th>
              <th className="p-4 font-bold text-center">Status</th>
              <th className="p-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-secondary text-sm">
                  <Tag className="mx-auto mb-2 text-outline" size={32} />
                  No categories match your filter.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.id}
                  className={`border-b border-outline/10 text-sm transition-colors ${
                    c.is_active
                      ? 'hover:bg-surface-container-high'
                      : 'bg-surface-container/40 opacity-70 hover:opacity-100'
                  }`}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-8 h-8 rounded-lg flex-shrink-0"
                        style={{ backgroundColor: c.color_hex }}
                      />
                      <span className="font-bold text-on-surface">{c.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className="font-mono text-xs uppercase text-secondary">{c.color_hex}</span>
                  </td>
                  <td className="p-4 text-center text-secondary">{c.display_order}</td>
                  <td className="p-4 text-center">
                    <span className="text-xs text-secondary">
                      {/* products count is not returned here so we leave a dash */}
                      —
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    {c.is_active ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(c)}
                        title="Edit"
                        className="p-2 text-secondary hover:text-primary transition-colors rounded-lg hover:bg-surface-container-high"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(c.id)}
                        disabled={togglingId === c.id}
                        title={c.is_active ? 'Deactivate' : 'Activate'}
                        className={`p-2 transition-colors rounded-lg hover:bg-surface-container-high ${
                          c.is_active ? 'text-emerald-600 hover:text-red-500' : 'text-red-400 hover:text-emerald-600'
                        }`}
                      >
                        {c.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline/10 p-6 rounded-2xl w-full max-w-md space-y-4">
            <h3 className="font-headline font-bold text-lg text-on-surface">
              {editingId ? 'Edit Category' : 'Create Category'}
            </h3>
            {modalError && <p className="text-xs text-error bg-error-container/20 p-3 rounded-lg">{modalError}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Category Name</label>
                <input
                  type="text" required
                  placeholder="e.g. Hot Drinks"
                  className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                  value={name} onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary uppercase mb-1">Color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      className="w-12 h-10 border rounded bg-transparent p-0 cursor-pointer"
                      value={colorHex} onChange={(e) => setColorHex(e.target.value)}
                    />
                    <input
                      type="text"
                      className="w-full p-2 bg-surface-container-low border rounded text-xs font-mono uppercase"
                      value={colorHex} onChange={(e) => setColorHex(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary uppercase mb-1">Sort Order</label>
                  <input
                    type="number" required
                    className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                    value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-4 py-2 border border-outline/10 rounded-lg text-sm font-semibold hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary/95"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
