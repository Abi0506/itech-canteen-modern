import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Plus, ToggleLeft, ToggleRight, Folder, AlertCircle } from 'lucide-react';

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [newCatName, setNewCatName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchCats = async () => {
    try {
      const res = await api.get('/admin/categories');
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

  const handleAddCategory = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/admin/categories', { name: newCatName });
      setNewCatName('');
      fetchCats();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create category');
    }
  };

  const handleToggle = async (catId) => {
    try {
      const res = await api.post(`/admin/categories/${catId}/toggle`);
      setCategories(categories.map(c => c.id === catId ? { ...c, is_active: res.data.is_active } : c));
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
    <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-8 font-body">
      
      {/* Category List */}
      <div className="md:col-span-2 space-y-6">
        <div>
          <h1 className="font-headline font-bold text-2xl text-on-surface">Categories</h1>
          <p className="text-secondary text-sm">Control active and inactive menu categories.</p>
        </div>

        <div className="bg-surface-container-low border border-outline/10 rounded-2xl overflow-hidden divide-y divide-outline/10 shadow-sm">
          {categories.map(cat => (
            <div key={cat.id} className="p-4 flex items-center justify-between gap-4 bg-surface-container-lowest">
              <div className="flex items-center gap-3">
                <Folder className="text-primary" size={18} />
                <span className="font-headline font-bold text-sm text-on-surface">{cat.name}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase ${cat.is_active ? 'text-emerald-600' : 'text-outline'}`}>
                  {cat.is_active ? 'Active' : 'Inactive'}
                </span>
                <button onClick={() => handleToggle(cat.id)} className="text-secondary hover:text-primary">
                  {cat.is_active ? <ToggleRight size={28} className="text-primary" /> : <ToggleLeft size={28} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Category Form */}
      <div>
        <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4">
          <h3 className="font-headline font-bold text-sm text-on-surface">Add Menu Category</h3>
          <p className="text-secondary text-xs">Register new category grouping for cafeteria food items.</p>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-error-container/20 border border-error/10 rounded-xl text-error text-xs">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAddCategory} className="space-y-4">
            <input
              type="text"
              placeholder="e.g. Desserts"
              className="w-full px-4 py-3 bg-surface-container-lowest border border-outline/20 rounded-xl text-xs"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              required
            />
            <button
              type="submit"
              className="w-full py-3 bg-primary text-on-primary font-bold rounded-xl hover:bg-on-primary-fixed-variant transition-colors text-xs flex items-center justify-center gap-1.5"
            >
              <Plus size={14} />
              Create Category
            </button>
          </form>
        </div>
      </div>

    </div>
  );
};

export default Categories;
