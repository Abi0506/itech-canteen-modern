import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useCart } from '../../context/CartContext';
import { Search, Heart, ShoppingCart, Info, Check } from 'lucide-react';

const Dashboard = () => {
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [search, setSearch] = useState('');
  const [onlyVeg, setOnlyVeg] = useState(false);
  const [loading, setLoading] = useState(true);
  const { addToCart, cart } = useCart();
  const [favourites, setFavourites] = useState([]);
  const [feedbackItem, setFeedbackItem] = useState(null);

  const loadData = async () => {
    try {
      const res = await api.get('/users/categories');
      setCategories(res.data);
      if (res.data.length > 0) {
        setActiveCategory(res.data[0].id);
      }
      
      const profile = await api.get('/users/profile');
      setFavourites(profile.data.favourites || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleFavourite = async (itemId) => {
    try {
      const res = await api.post(`/users/favourites/toggle?item_id=${itemId}`);
      setFavourites(res.data.favourites);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddToCart = (item) => {
    addToCart(item, 1);
    setFeedbackItem(item.id);
    setTimeout(() => {
      setFeedbackItem(null);
    }, 1500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Filter items based on active category, search string, and vegetarian settings
  const getFilteredItems = () => {
    const currentCat = categories.find(c => c.id === activeCategory);
    if (!currentCat) return [];

    return currentCat.items.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                          (item.description && item.description.toLowerCase().includes(search.toLowerCase()));
      const isVeg = !item.name.toLowerCase().includes('chicken') && 
                     !item.name.toLowerCase().includes('egg') && 
                     !item.name.toLowerCase().includes('fish') &&
                     !item.name.toLowerCase().includes('meat');
      const matchVeg = !onlyVeg || isVeg;
      return matchSearch && matchVeg;
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      
      {/* Search and Filters Header */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-8">
        <div>
          <h1 className="font-headline font-bold text-2xl text-on-surface">Campus Dining Menu</h1>
          <p className="text-secondary text-sm">Select items and place your order instantly.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative flex-grow sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" size={16} />
            <input
              type="text"
              placeholder="Search food item..."
              className="w-full pl-9 pr-4 py-2 rounded-full border border-outline/20 bg-surface-container-low text-sm focus:ring-1 focus:ring-primary/20"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Veg Only Toggle */}
          <button
            onClick={() => setOnlyVeg(!onlyVeg)}
            className={`px-4 py-2 rounded-full text-xs font-bold border transition-colors flex items-center gap-1.5 ${
              onlyVeg 
                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600' 
                : 'border-outline/20 text-secondary hover:bg-surface-container-high'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${onlyVeg ? 'bg-emerald-500' : 'bg-outline/50'}`}></span>
            Veg Only
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex border-b border-outline/15 overflow-x-auto gap-2 mb-6 scrollbar-hide">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`pb-3 px-4 font-headline text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
              activeCategory === cat.id
                ? 'border-primary text-primary'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Food Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {getFilteredItems().map(item => {
          const inCart = cart.find(ci => ci.id === item.id);
          const isFavourite = favourites.includes(item.id);

          return (
            <div key={item.id} className="bg-surface-container-lowest rounded-2xl border border-outline/10 overflow-hidden flex flex-col group transition-all hover:shadow-lg">
              
              {/* Image with overlay action */}
              <div className="relative aspect-[4/3] bg-surface-container-high overflow-hidden">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-outline/30">
                    <span className="material-symbols-outlined text-4xl">restaurant</span>
                  </div>
                )}
                
                {/* Favourite toggle overlay */}
                <button
                  onClick={() => handleToggleFavourite(item.id)}
                  className="absolute top-3 right-3 p-2 bg-white/80 hover:bg-white text-secondary rounded-full shadow-sm hover:scale-110 transition-transform"
                >
                  <Heart size={16} className={isFavourite ? 'fill-red-500 text-red-500' : ''} />
                </button>
              </div>

              {/* Card Body */}
              <div className="p-4 flex flex-col flex-grow">
                <div className="flex justify-between items-start gap-2 mb-1">
                  <h3 className="font-headline font-bold text-on-surface text-base group-hover:text-primary transition-colors line-clamp-1">
                    {item.name}
                  </h3>
                  <span className="font-headline font-bold text-primary text-sm whitespace-nowrap">
                    ₹{parseFloat(item.price).toFixed(2)}
                  </span>
                </div>

                <p className="text-secondary text-xs line-clamp-2 mb-4 flex-grow">
                  {item.description || 'No description available.'}
                </p>

                {/* Stock status and cart action */}
                <div className="flex items-center justify-between gap-3 mt-auto">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline font-bold uppercase tracking-wider">Available</span>
                    <span className={`text-xs font-bold ${item.quantity_available > 0 ? 'text-emerald-600' : 'text-error'}`}>
                      {item.quantity_available > 0 ? `${item.quantity_available} units` : 'Out of stock'}
                    </span>
                  </div>

                  <button
                    onClick={() => handleAddToCart(item)}
                    disabled={item.quantity_available <= 0}
                    className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                      item.quantity_available <= 0
                        ? 'bg-outline/10 text-outline/40 cursor-not-allowed'
                        : feedbackItem === item.id
                        ? 'bg-emerald-500 text-white'
                        : 'bg-primary text-on-primary hover:bg-on-primary-fixed-variant'
                    }`}
                  >
                    {feedbackItem === item.id ? <Check size={14} /> : <ShoppingCart size={14} />}
                    {feedbackItem === item.id ? 'Added' : 'Add'}
                  </button>
                </div>

              </div>
            </div>
          );
        })}

        {getFilteredItems().length === 0 && (
          <div className="col-span-full py-12 text-center text-outline">
            <Info className="mx-auto mb-2 opacity-50" size={24} />
            <p className="text-sm font-medium">No items match your filters.</p>
          </div>
        )}
      </div>

    </div>
  );
};

export default Dashboard;
