import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { Layers, Coffee, Landmark, User, Trash2 } from 'lucide-react';

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
    if (table.current_status === 'available') {
      navigate(`/cashier/order/${table.id}`);
    } else {
      navigate(`/cashier/order/${table.id}`);
    }
  };

  const handleRelease = async (tableId, e) => {
    e.stopPropagation();
    if (!window.confirm('Mark this table as freed (available)?')) return;
    try {
      await api.post(`/cashier/tables/${tableId}/release`);
      fetchTables();
    } catch (err) {
      alert('Failed to release table');
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
      <div>
        <h1 className="font-headline font-bold text-2xl text-on-surface">Tables Layout</h1>
        <p className="text-secondary text-sm">Select an available table to begin a cashier checkout order, or release reserved tables.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {tables.map((t) => {
          let cardBg = 'bg-emerald-50/50 border-emerald-200';
          let statusText = 'Available';
          if (t.current_status === 'occupied') {
            cardBg = 'bg-primary/5 border-primary/20';
            statusText = 'Occupied';
          } else if (t.current_status === 'reserved') {
            cardBg = 'bg-amber-50/50 border-amber-200';
            statusText = 'Reserved';
          }

          return (
            <div
              key={t.id}
              onClick={() => handleSelectTable(t)}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all hover:scale-[1.03] flex flex-col justify-between h-44 ${cardBg}`}
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-headline font-bold text-base text-on-surface">Table {t.table_number}</h3>
                    <p className="text-[10px] text-outline font-bold uppercase">{t.seats} seats</p>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                    t.current_status === 'available' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                    t.current_status === 'occupied' ? 'bg-primary-fixed text-on-primary-fixed-variant border-primary/10' :
                    'bg-amber-100 text-amber-800 border-amber-200'
                  }`}>
                    {statusText}
                  </span>
                </div>

                {t.waiter_name && (
                  <p className="text-[11px] text-secondary flex items-center gap-1">
                    <User size={12} className="text-primary" />
                    Server: <strong>{t.waiter_name}</strong>
                  </p>
                )}
              </div>

              <div className="flex justify-between items-center border-t border-outline/5 pt-3">
                <span className="text-[10px] text-primary font-bold uppercase tracking-wider">
                  {t.current_status === 'available' ? 'Start Order' : 'Edit Cart'}
                </span>
                
                {(t.current_status === 'reserved' || t.current_status === 'occupied') && (
                  <button
                    onClick={(e) => handleRelease(t.id, e)}
                    className="p-1.5 text-secondary hover:text-error hover:bg-error/5 rounded transition-all"
                    title="Free Table"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Tables;
