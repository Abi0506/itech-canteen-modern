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
      <div className="flex items-center justify-center min-h-[50vh] bg-surface">
        <div className="flex items-center gap-3 rounded-full border border-outline/10 bg-surface-container-low px-4 py-3 text-secondary shadow-sm">
          <CircleDashed className="animate-spin" size={18} />
          <span className="text-sm font-medium">Loading tables...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-57px)] overflow-hidden bg-[linear-gradient(180deg,#fffaf4_0%,#fffdf8_100%)] font-body">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(255,255,255,0))]" />

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
          return (
            <div
              key={t.id}
              onClick={() => handleSelectTable(t)}
              className="group relative min-h-48 cursor-pointer overflow-hidden rounded-[1.75rem] border border-outline/10 bg-white/80 p-5 shadow-[0_10px_30px_rgba(27,28,26,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(27,28,26,0.08)]"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/25 to-transparent" />
              <div className="flex h-full flex-col justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-outline">Table</p>
                  <h3 className="mt-2 text-3xl font-black tracking-tight text-on-surface">{t.table_number}</h3>
                  <p className="mt-2 text-sm font-semibold uppercase tracking-[0.16em] text-secondary">
                    {t.seats} seats
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-outline/10 pt-4">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                    Start cashier order
                  </span>
                  <ArrowRight size={15} className="text-primary transition-transform duration-300 group-hover:translate-x-1" />
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
