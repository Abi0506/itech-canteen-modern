import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Plus, Trash2, MapPin, Edit } from 'lucide-react';

const FloorSetup = () => {
  const [floors, setFloors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showFloorModal, setShowFloorModal] = useState(false);
  const [editingFloor, setEditingFloor] = useState(null);
  const [floorName, setFloorName] = useState('');

  const [showTableModal, setShowTableModal] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
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

  const openAddFloorModal = () => {
    setEditingFloor(null);
    setFloorName('');
    setShowFloorModal(true);
  };

  const openEditFloorModal = (floor) => {
    setEditingFloor(floor);
    setFloorName(floor.name);
    setShowFloorModal(true);
  };

  const handleSaveFloor = async (e) => {
    e.preventDefault();
    try {
      if (editingFloor) {
        await api.put(`/admin/floors/${editingFloor.id}`, { name: floorName });
      } else {
        await api.post('/admin/floors', { name: floorName });
      }
      setShowFloorModal(false);
      setFloorName('');
      setEditingFloor(null);
      fetchLayout();
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to save floor');
    }
  };

  const handleDeleteFloor = async (floorId) => {
    if (!window.confirm('Are you sure you want to delete this floor?')) return;
    try {
      await api.delete(`/admin/floors/${floorId}`);
      fetchLayout();
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to delete floor');
    }
  };

  const openAddTableModal = () => {
    setEditingTable(null);
    if (floors.length > 0) {
      setSelectedFloorId(floors[0].id);
    }
    setTableNumber('');
    setSeats(2);
    setShowTableModal(true);
  };

  const openEditTableModal = (table, floorId) => {
    setEditingTable(table);
    setSelectedFloorId(floorId);
    setTableNumber(table.table_number);
    setSeats(table.seats);
    setShowTableModal(true);
  };

  const handleSaveTable = async (e) => {
    e.preventDefault();
    if (!selectedFloorId && !editingTable) {
      alert('Please select a floor first. If no floors exist, create one first.');
      return;
    }
    try {
      if (editingTable) {
        await api.put(`/admin/tables/${editingTable.id}`, {
          table_number: tableNumber.toString(),
          seats: parseInt(seats)
        });
      } else {
        await api.post('/admin/tables', {
          floor_id: parseInt(selectedFloorId),
          table_number: tableNumber.toString(),
          seats: parseInt(seats)
        });
      }
      setShowTableModal(false);
      setTableNumber('');
      setEditingTable(null);
      fetchLayout();
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to save table');
    }
  };

  const handleDeleteTable = async (tableId) => {
    if (!window.confirm('Are you sure you want to delete this table?')) return;
    try {
      await api.delete(`/admin/tables/${tableId}`);
      fetchLayout();
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to delete table');
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
            onClick={openAddFloorModal}
            className="flex items-center gap-2 px-4 py-2.5 border border-outline/10 text-secondary hover:bg-surface-container rounded-xl text-sm font-semibold transition-all"
          >
            <Plus size={18} />
            Add Floor
          </button>
          <button
            onClick={openAddTableModal}
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
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-secondary font-bold uppercase">{f.tables.length} Tables Registered</span>
              <div className="flex gap-1">
                <button
                  onClick={() => openEditFloorModal(f)}
                  className="p-1.5 text-secondary hover:text-primary transition-colors bg-surface border border-outline/10 rounded"
                  title="Edit Floor"
                >
                  <Edit size={14} />
                </button>
                <button
                  onClick={() => handleDeleteFloor(f.id)}
                  className="p-1.5 text-secondary hover:text-error transition-colors bg-surface border border-outline/10 rounded"
                  title="Delete Floor"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {f.tables.map((t) => (
              <div
                key={t.id}
                className="p-4 rounded-xl border border-outline/10 bg-surface flex flex-col justify-between items-center text-center space-y-3 relative group"
              >
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEditTableModal(t, f.id)}
                    className="p-1 text-secondary hover:text-primary transition-colors bg-surface-container rounded-md"
                    title="Edit Table"
                  >
                    <Edit size={12} />
                  </button>
                  <button
                    onClick={() => handleDeleteTable(t.id)}
                    className="p-1 text-secondary hover:text-error transition-colors bg-surface-container rounded-md"
                    title="Delete Table"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                
                <div className="mt-2">
                  <h4 className="font-headline font-bold text-base text-on-surface">T-{t.table_number}</h4>
                  <p className="text-[10px] text-secondary">{t.seats} Seats capacity</p>
                </div>
                <div className="flex flex-col gap-1 w-full mt-2">
                  <a
                    href={`http://localhost:5173/self-order/${f.name.replace(/\s+/g, '-')}-${t.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2 py-1.5 text-[10px] font-bold bg-primary-fixed text-on-primary-fixed-variant rounded hover:opacity-90 block w-full text-center"
                  >
                    View QR Menu
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Floor Modal */}
      {showFloorModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline/10 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-xl">
            <h3 className="font-headline font-bold text-lg text-on-surface">
              {editingFloor ? 'Edit Floor Section' : 'Add Floor Section'}
            </h3>
            <form onSubmit={handleSaveFloor} className="space-y-4">
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
                  {editingFloor ? 'Save Changes' : 'Save Floor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table Modal */}
      {showTableModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline/10 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-xl">
            <h3 className="font-headline font-bold text-lg text-on-surface">
              {editingTable ? 'Edit Table' : 'Add Table to Layout'}
            </h3>
            <form onSubmit={handleSaveTable} className="space-y-4">
              {!editingTable && (
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
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary uppercase mb-1">Table Number</label>
                  <input
                    type="number" required min="1"
                    placeholder="e.g. 15"
                    className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                    value={tableNumber} onChange={(e) => setTableNumber(e.target.value)}
                  />
                  <p className="text-[10px] text-secondary mt-1">Must be numbers only</p>
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
                  {editingTable ? 'Save Changes' : 'Save Table'}
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
