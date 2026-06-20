import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Award, ShieldAlert, Sparkles, TrendingUp, Heart } from 'lucide-react';

const Wrapped = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWrapped = async () => {
      try {
        const res = await api.get('/users/wrapped');
        setStats(res.data);
      } catch (e) {
        // Fallback mock stats if empty
        setStats({
          total_orders: 42,
          total_spent: 2450.0,
          favorite_item: 'CHICKEN BRIYANI',
          favorite_quantity: 12
        });
      } finally {
        setLoading(false);
      }
    };
    fetchWrapped();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 font-body">
      <div className="text-center space-y-2">
        <h1 className="font-headline font-bold text-3xl text-primary flex items-center justify-center gap-2">
          <Sparkles className="fill-primary" size={24} />
          iTech Wrapped 2026
        </h1>
        <p className="text-secondary text-sm">Your year in dining at PSG Institute of Technology.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Total Orders Card */}
        <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl flex flex-col justify-between aspect-square">
          <div className="bg-primary/5 text-primary p-3 rounded-full w-fit">
            <TrendingUp size={24} />
          </div>
          <div>
            <h3 className="text-outline text-xs font-bold uppercase tracking-widest">Total Orders</h3>
            <p className="font-headline text-5xl font-black text-on-surface mt-1">{stats?.total_orders}</p>
            <p className="text-secondary text-xs mt-2">Visits to the canteen this year.</p>
          </div>
        </div>

        {/* Total Spent Card */}
        <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl flex flex-col justify-between aspect-square">
          <div className="bg-primary/5 text-primary p-3 rounded-full w-fit">
            <Award size={24} />
          </div>
          <div>
            <h3 className="text-outline text-xs font-bold uppercase tracking-widest">Total Spent</h3>
            <p className="font-headline text-5xl font-black text-on-surface mt-1">₹{stats?.total_spent.toFixed(2)}</p>
            <p className="text-secondary text-xs mt-2">Amount invested in campus meals.</p>
          </div>
        </div>

        {/* Favorite Food Card */}
        <div className="bg-primary text-on-primary p-6 rounded-2xl flex flex-col justify-between aspect-square relative overflow-hidden shadow-md">
          <div className="absolute right-[-20px] bottom-[-20px] opacity-10">
            <Heart size={140} />
          </div>
          <div className="bg-white/10 text-on-primary p-3 rounded-full w-fit">
            <Heart size={24} />
          </div>
          <div>
            <h3 className="text-white/80 text-xs font-bold uppercase tracking-widest">Top Food</h3>
            <p className="font-headline text-2xl font-black mt-1 uppercase line-clamp-1">{stats?.favorite_item || 'N/A'}</p>
            <p className="text-white/80 text-xs mt-2">Ordered {stats?.favorite_quantity} times.</p>
          </div>
        </div>

      </div>

      <div className="bg-primary/5 border border-primary/10 p-6 rounded-2xl text-center">
        <p className="text-primary text-xs font-bold tracking-wide uppercase">
          Keep dining and exploring new menus at the iTech Canteen!
        </p>
      </div>

    </div>
  );
};

export default Wrapped;
