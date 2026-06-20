import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Plus, Trash2, MapPin, Layers } from 'lucide-react';

const FloorSetup = () => {
  const [floors, setFloors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showFloorModal, setShowFloorModal] = useState(false);
  const [floorName, setFloorName] = useState('');

  const [showTableModal, setShowTableModal] = useState(false);
  const [selectedFloorId, setSelectedFloorId] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [seats, setSeats] = useState(2);

  const fetchLayout = async () => {
    try {
      const res = await api.get('/admin/floors');
      setFloors(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLayout();
  }, []);

  const handleAddFloor = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/floors', { name: floorName });
      setShowFloorModal(false);
      setFloorName('');
      fetchLayout();
    } catch (e) {
      alert('Failed to add floor');
    }
  };

  const handleAddTable = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/tables', {
        floor_id: parseInt(selectedFloorId),
        table_number: tableNumber,
        seats: parseInt(seats)
      });
      setShowTableModal(false);
      setTableNumber('');
      fetchLayout();
    } catch (e) {
      alert('Failed to add table');
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
          <h1 className="font-headline font-bold text-2xl text-on-surface">Floors & Tables Setup</h1>
          <p className="text-secondary text-sm">Design your cafe layout, define seat sizes, and manage floor mappings.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFloorModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-outline/10 text-secondary hover:bg-surface-container rounded-xl text-sm font-semibold transition-all"
          >
            <Plus size={18} />
            Add Floor
          </button>
          <button
            onClick={() => {
              if (floors.length > 0) {
                setSelectedFloorId(floors[0].id);
              }
              setShowTableModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl hover:bg-primary/95 text-sm font-semibold transition-all shadow"
          >
            <Plus size={18} />
            Add Table
          </button>
        </div>
      </div>

      {floors.map((f) => (
        <div key={f.id} className="space-y-4 bg-surface-container-low border border-outline/10 p-6 rounded-2xl">
          <div className="flex justify-between items-center border-b border-outline/5 pb-3">
            <h3 className="font-headline font-bold text-base flex items-center gap-2 text-primary">
              <MapPin size={18} />
              {f.name}
            </h3>
            <span className="text-[10px] text-secondary font-bold uppercase">{f.tables.length} Tables Registered</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {f.tables.map((t) => (
              <div
                key={t.id}
                className="p-4 rounded-xl border border-outline/10 bg-surface flex flex-col justify-between items-center text-center space-y-3"
              >
                <div>
                  <h4 className="font-headline font-bold text-base text-on-surface">T-{t.table_number}</h4>
                  <p className="text-[10px] text-secondary">{t.seats} Seats capacity</p>
                </div>
                <div className="flex flex-col gap-1 w-full">
                  <a
                    href={`http://localhost:8000/selforder/${t.qr_token}/menu`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2 py-1 text-[10px] font-bold bg-primary-fixed text-on-primary-fixed-variant rounded hover:opacity-90 block"
                  >
                    View QR Menu
                  </a>
                  <button
                    onClick={() => alert('Table delete is stubbed')}
                    className="p-1 text-secondary hover:text-error transition-colors flex items-center justify-center"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Floor Modal */}
      {showFloorModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline/10 p-6 rounded-2xl w-full max-w-md space-y-4">
            <h3 className="font-headline font-bold text-lg text-on-surface">Add Floor Section</h3>
            <form onSubmit={handleAddFloor} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Floor Name</label>
                <input
                  type="text" required
                  placeholder="e.g. Roof Top Canteen"
                  className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                  value={floorName} onChange={(e) => setFloorName(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFloorModal(false)}
                  className="px-4 py-2 border border-outline/10 rounded-lg text-sm font-semibold hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary/95"
                >
                  Save Floor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table Modal */}
      {showTableModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline/10 p-6 rounded-2xl w-full max-w-md space-y-4">
            <h3 className="font-headline font-bold text-lg text-on-surface">Add Table to Layout</h3>
            <form onSubmit={handleAddTable} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Floor Section</label>
                <select
                  className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                  value={selectedFloorId} onChange={(e) => setSelectedFloorId(e.target.value)}
                >
                  {floors.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary uppercase mb-1">Table Number</label>
                  <input
                    type="text" required
                    placeholder="e.g. 15"
                    className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                    value={tableNumber} onChange={(e) => setTableNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary uppercase mb-1">Seats Count</label>
                  <input
                    type="number" required min="1" max="20"
                    className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                    value={seats} onChange={(e) => setSeats(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTableModal(false)}
                  className="px-4 py-2 border border-outline/10 rounded-lg text-sm font-semibold hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary/95"
                >
                  Save Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default FloorSetup;
