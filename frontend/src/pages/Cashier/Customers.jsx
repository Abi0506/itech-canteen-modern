import React, { useState } from 'react';
import api from '../../utils/api';
import { Search, UserPlus } from 'lucide-react';

const Customers = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Form states
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query) return;
    setSearching(true);
    try {
      const res = await api.get(`/cashier/customers/search?q=${query}`);
      setResults(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await api.post('/cashier/customers', {
        name,
        mobile_number: mobile,
        email: email || null
      });
      setShowModal(false);
      setName('');
      setMobile('');
      setEmail('');
      alert('Customer registered successfully!');
    } catch (err) {
      alert('Failed to register customer');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 font-body">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-headline font-bold text-2xl text-on-surface">Customers directory</h1>
          <p className="text-secondary text-sm">Lookup customer profiles or sign up guest contacts for loyalty tracking.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl hover:bg-primary/95 text-sm font-semibold transition-all shadow"
        >
          <UserPlus size={18} />
          Register Customer
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
        <input
          type="text" required
          placeholder="Search by name or phone..."
          className="flex-1 px-4 py-2.5 bg-surface border border-outline/10 rounded-xl text-sm"
          value={query} onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="submit"
          className="px-4 py-2.5 bg-surface-container-highest border text-on-surface font-semibold rounded-xl text-sm hover:bg-secondary-container transition-all"
        >
          Search
        </button>
      </form>

      {/* Results */}
      <div className="overflow-x-auto bg-surface-container-low border border-outline/10 rounded-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline/10 text-outline text-xs uppercase tracking-wider">
              <th className="p-4 font-bold">Name</th>
              <th className="p-4 font-bold">Mobile Number</th>
              <th className="p-4 font-bold">Email</th>
            </tr>
          </thead>
          <tbody>
            {results.map((c) => (
              <tr key={c.id} className="border-b border-outline/10 text-sm hover:bg-surface-container-high transition-colors">
                <td className="p-4 font-bold text-on-surface">{c.name}</td>
                <td className="p-4 text-secondary">{c.mobile_number}</td>
                <td className="p-4 text-secondary">{c.email || 'N/A'}</td>
              </tr>
            ))}
            {results.length === 0 && (
              <tr>
                <td colSpan="3" className="p-8 text-center text-outline italic text-xs">
                  {searching ? 'Searching records...' : 'Use the search bar above to look up customer records.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Register Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline/10 p-6 rounded-2xl w-full max-w-sm space-y-4">
            <h3 className="font-headline font-bold text-lg text-on-surface">Associate Customer</h3>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Customer Name</label>
                <input
                  type="text" required
                  className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                  value={name} onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Mobile Number (Mandatory)</label>
                <input
                  type="text" required
                  className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                  value={mobile} onChange={(e) => setMobile(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Email (Optional)</label>
                <input
                  type="email"
                  className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                />
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
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Customers;
