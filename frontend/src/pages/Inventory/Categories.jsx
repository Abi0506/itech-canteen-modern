import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Plus, Edit } from 'lucide-react';

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [colorHex, setColorHex] = useState('#CCCCCC');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [modalError, setModalError] = useState('');

  const fetchCats = async () => {
    try {
      const res = await api.get('/inventory/categories');
      setCategories(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCats();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    const payload = {
      name,
      color_hex: colorHex,
      display_order: Number(displayOrder)
    };

    try {
      if (editingId) {
        await api.put(`/inventory/categories/${editingId}`, payload);
      } else {
        await api.post('/inventory/categories', payload);
      }
      setShowModal(false);
      setName('');
      setColorHex('#CCCCCC');
      setDisplayOrder(0);
      setEditingId(null);
      fetchCats();
    } catch (err) {
      setModalError(err.response?.data?.detail || 'Failed to save category');
    }
  };

  const handleEdit = (cat) => {
    setEditingId(cat.id);
    setName(cat.name);
    setColorHex(cat.color_hex);
    setDisplayOrder(cat.display_order);
    setShowModal(true);
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
          <h1 className="font-headline font-bold text-2xl text-on-surface">Categories Setup</h1>
          <p className="text-secondary text-sm">Organize food products into high-level categories with custom color-coding tags.</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setName('');
            setColorHex('#CCCCCC');
            setDisplayOrder(0);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl hover:bg-primary/95 text-sm font-semibold transition-all shadow"
        >
          <Plus size={18} />
          Add Category
        </button>
      </div>

      <div className="overflow-x-auto bg-surface-container-low border border-outline/10 rounded-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline/10 text-outline text-xs uppercase tracking-wider">
              <th className="p-4 font-bold">Category Name</th>
              <th className="p-4 font-bold text-center">Visual Color Badge</th>
              <th className="p-4 font-bold text-center">Sort Order</th>
              <th className="p-4 font-bold text-center">Status</th>
              <th className="p-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-b border-outline/10 text-sm hover:bg-surface-container-high transition-colors">
                <td className="p-4 font-bold text-on-surface">{c.name}</td>
                <td className="p-4 text-center">
                  <div className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border border-outline/20" style={{ backgroundColor: c.color_hex }} />
                    <span className="font-mono text-xs uppercase">{c.color_hex}</span>
                  </div>
                </td>
                <td className="p-4 text-center text-secondary">{c.display_order}</td>
                <td className="p-4 text-center">
                  {c.is_active ? (
                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800">Active</span>
                  ) : (
                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-error-container text-on-error-container">Inactive</span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => handleEdit(c)}
                    className="p-2 text-secondary hover:text-primary transition-colors"
                  >
                    <Edit size={18} />
                  </button>
                </td>
              </tr>
            ))}
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
            {modalError && <p className="text-xs text-error">{modalError}</p>}
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
                  <label className="block text-xs font-semibold text-secondary uppercase mb-1">Color Picker</label>
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
                  <label className="block text-xs font-semibold text-secondary uppercase mb-1">Display Sort Order</label>
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
                  onClick={() => setShowModal(false)}
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
