import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { ArrowRight, CircleDashed, Sparkles } from 'lucide-react';

const Tables = () => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchTables = async () => {
    try {
      const res = await api.get('/cashier/tables');
      setTables(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const handleSelectTable = (table) => {
    navigate(`/cashier/order/${table.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] bg-surface text-secondary dark:bg-surface dark:text-secondary">
        <div className="flex items-center gap-3 rounded-full border border-outline/10 bg-surface-container-low px-4 py-3 text-secondary shadow-sm dark:border-outline/15 dark:bg-surface-container-lowest">
          <CircleDashed className="animate-spin" size={18} />
          <span className="text-sm font-medium">Loading tables...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-57px)] overflow-hidden bg-[linear-gradient(180deg,#fffaf4_0%,#fffdf8_100%)] font-body dark:bg-[linear-gradient(180deg,#1b1c1a_0%,#141514_100%)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(255,255,255,0))] dark:bg-[linear-gradient(180deg,rgba(27,28,26,0.92),rgba(27,28,26,0))]" />

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
              <Sparkles size={12} />
              Cashier Desk
            </div>
            <h1 className="font-headline text-3xl font-black tracking-tight text-on-surface sm:text-4xl">
              Select a table
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-secondary sm:text-base">
              Tap any table to open cashier ordering, add items, and complete billing in one flow.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {tables.map((t) => {
          const isOccupied = t.current_status !== 'available';
          return (
            <div
              key={t.id}
              onClick={() => handleSelectTable(t)}
              className={`group relative min-h-48 cursor-pointer overflow-hidden rounded-[1.75rem] border p-5 shadow-[0_10px_30px_rgba(27,28,26,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(27,28,26,0.08)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.28)] ${
                isOccupied
                  ? 'border-amber-500/20 bg-amber-50/40 hover:bg-amber-50/60 dark:border-amber-500/25 dark:bg-amber-950/20 dark:hover:bg-amber-950/30'
                  : 'border-outline/10 bg-white/80 dark:border-outline/15 dark:bg-surface-container-low'
              }`}
            >
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${isOccupied ? 'from-amber-500 to-transparent' : 'from-primary/25 to-transparent'} dark:opacity-80`} />
              <div className="flex h-full flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-outline dark:text-outline/90">Table</p>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      isOccupied
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-100'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${isOccupied ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      {t.current_status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    {t.floor_name && (
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline bg-surface-container-high px-2 py-0.5 rounded-full dark:bg-surface-container dark:text-secondary">
                        {t.floor_name}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 text-3xl font-black tracking-tight text-on-surface">{t.table_number}</h3>
                  <p className="mt-2 text-sm font-semibold uppercase tracking-[0.16em] text-secondary">
                    {t.seats} seats
                  </p>
                  
                  {isOccupied && t.active_order_total > 0 && (
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/90 border border-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-900 shadow-sm dark:border-amber-500/20 dark:bg-amber-950/35 dark:text-amber-100">
                      <span className="text-[10px] font-normal text-amber-700 uppercase">Bill Due:</span>
                      Rs.{Number(t.active_order_total).toFixed(2)}
                    </div>
                  )}
                </div>

                <div className={`flex items-center justify-between border-t pt-4 ${isOccupied ? 'border-amber-500/10 dark:border-amber-500/15' : 'border-outline/10 dark:border-outline/15'}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-[0.18em] ${isOccupied ? 'text-amber-900' : 'text-primary'}`}>
                    {isOccupied ? 'View / Settle Order' : 'Start cashier order'}
                  </span>
                  <ArrowRight size={15} className={`${isOccupied ? 'text-amber-700' : 'text-primary'} transition-transform duration-300 group-hover:translate-x-1`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
};

export default Tables;
