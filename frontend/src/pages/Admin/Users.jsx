import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Plus, Trash2, Key, ToggleLeft, ToggleRight, UserCheck } from 'lucide-react';

const passwordConstraintMessage = 'Password must be at least 8 characters and contain one uppercase letter, one number, and one special character.';

const Users = () => {
  const [data, setData] = useState({ staff: [], customers: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('staff');
  
  // Add staff modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState(2); // employee by default
  const [modalError, setModalError] = useState('');
  const [popupMessage, setPopupMessage] = useState('');
  const [popupTitle, setPopupTitle] = useState('Constraint not satisfied');
  const [resetPasswordTarget, setResetPasswordTarget] = useState(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleActive = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/archive`);
      fetchUsers();
    } catch (e) {
      alert('Failed to toggle active status');
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      fetchUsers();
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to delete user');
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    setModalError('');
    if (!passwordConstraintOk(password)) {
      openPopup(passwordConstraintMessage);
      setModalError(passwordConstraintMessage);
      return;
    }
    try {
      await api.post('/admin/users', {
        name,
        email,
        mobile_number: mobileNumber,
        password,
        role_id: Number(roleId)
      });
      setShowAddModal(false);
      setName('');
      setEmail('');
      setMobileNumber('');
      setPassword('');
      fetchUsers();
    } catch (err) {
      setModalError(err.response?.data?.detail || 'Failed to create staff member');
    }
  };

  const passwordConstraintOk = (value) => (
    value.length >= 8
    && /[A-Z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9\s]/.test(value)
  );

  const openPopup = (message, title = 'Constraint not satisfied') => {
    setPopupTitle(title);
    setPopupMessage(message);
  };

  const closePopup = () => setPopupMessage('');

  const openResetPassword = (userId) => {
    setResetPasswordTarget(userId);
    setResetPasswordValue('');
    setResetPasswordError('');
  };

  const closeResetPassword = () => {
    setResetPasswordTarget(null);
    setResetPasswordValue('');
    setResetPasswordError('');
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetPasswordError('');

    if (!passwordConstraintOk(resetPasswordValue)) {
      setResetPasswordError(passwordConstraintMessage);
      openPopup(passwordConstraintMessage);
      return;
    }

    try {
      await api.put(`/admin/users/${resetPasswordTarget}/password`, { password: resetPasswordValue });
      closeResetPassword();
    } catch (err) {
      const message = err.response?.data?.detail || 'Failed to reset password';
      setResetPasswordError(message);
      openPopup(message);
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
          <h1 className="font-headline font-bold text-2xl text-on-surface">Users & Staff</h1>
          <p className="text-secondary text-sm">Manage system staff accounts, user permissions, and registered guests.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl hover:bg-primary/95 text-sm font-semibold transition-all shadow"
        >
          <Plus size={18} />
          Register Staff
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-outline/10 gap-4">
        <button
          onClick={() => setTab('staff')}
          className={`py-3 px-1 text-sm font-semibold border-b-2 transition-all ${
            tab === 'staff' ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-primary'
          }`}
        >
          Staff Directory ({data.staff.length})
        </button>
        <button
          onClick={() => setTab('customers')}
          className={`py-3 px-1 text-sm font-semibold border-b-2 transition-all ${
            tab === 'customers' ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-primary'
          }`}
        >
          Customers Base ({data.customers.length})
        </button>
      </div>

      {/* Staff Tab */}
      {tab === 'staff' && (
        <div className="overflow-x-auto bg-surface-container-low border border-outline/10 rounded-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline/10 text-outline text-xs uppercase tracking-wider">
                <th className="p-4 font-bold">Name</th>
                <th className="p-4 font-bold">Email</th>
                <th className="p-4 font-bold">Mobile</th>
                <th className="p-4 font-bold">Role</th>
                <th className="p-4 font-bold text-center">Status</th>
                <th className="p-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.staff.map((s) => (
                <tr key={s.id} className="border-b border-outline/10 text-sm hover:bg-surface-container-high transition-colors">
                  <td className="p-4 font-bold text-on-surface">{s.name}</td>
                  <td className="p-4 text-secondary">{s.email}</td>
                  <td className="p-4 text-secondary">{s.mobile_number}</td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-full bg-primary-fixed text-on-primary-fixed-variant">
                      {s.role_name}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button onClick={() => handleToggleActive(s.id)}>
                      {s.is_active ? (
                        <ToggleRight size={32} className="text-emerald-500 mx-auto" />
                      ) : (
                        <ToggleLeft size={32} className="text-secondary/40 mx-auto" />
                      )}
                    </button>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => openResetPassword(s.id)}
                      className="p-2 text-secondary hover:text-primary transition-colors"
                      title="Reset Password"
                    >
                      <Key size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-2 text-secondary hover:text-error transition-colors"
                      title="Delete User"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Customer Tab */}
      {tab === 'customers' && (
        <div className="overflow-x-auto bg-surface-container-low border border-outline/10 rounded-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline/10 text-outline text-xs uppercase tracking-wider">
                <th className="p-4 font-bold">Name</th>
                <th className="p-4 font-bold">Mobile</th>
                <th className="p-4 font-bold">Email</th>
                <th className="p-4 font-bold text-center">Guest?</th>
                <th className="p-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.customers.map((c) => (
                <tr key={c.id} className="border-b border-outline/10 text-sm hover:bg-surface-container-high transition-colors">
                  <td className="p-4 font-bold text-on-surface">{c.name}</td>
                  <td className="p-4 text-secondary">{c.mobile_number}</td>
                  <td className="p-4 text-secondary">{c.email || 'N/A'}</td>
                  <td className="p-4 text-center">
                    {c.is_guest ? (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-surface-variant text-secondary">Yes</span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800">No</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="p-2 text-secondary hover:text-error transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline/10 p-6 rounded-2xl w-full max-w-md space-y-4">
            <h3 className="font-headline font-bold text-lg text-on-surface">Register Staff Account</h3>
            {modalError && <p className="text-xs text-error">{modalError}</p>}
            <form onSubmit={handleAddStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Full Name</label>
                <input
                  type="text" required
                  className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                  value={name} onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Email</label>
                <input
                  type="email" required
                  className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Mobile Number</label>
                <input
                  type="text" required
                  className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                  value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Password</label>
                <input
                  type="password" required
                  className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  pattern="(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}"
                  title={passwordConstraintMessage}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Role Type</label>
                <select
                  className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                  value={roleId} onChange={(e) => setRoleId(e.target.value)}
                >
                  <option value={1}>Superadmin</option>
                  <option value={2}>Employee</option>
                  <option value={3}>Cashier</option>
                  <option value={4}>Inventory Manager</option>
                  <option value={5}>Chef</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-outline/10 rounded-lg text-sm font-semibold hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary/95"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {popupMessage && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-outline/10 bg-surface p-5 shadow-2xl">
            <h4 className="font-headline text-base font-bold text-on-surface">{popupTitle}</h4>
            <p className="mt-2 text-sm text-secondary">{popupMessage}</p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={closePopup}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary/95"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {resetPasswordTarget !== null && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-outline/10 bg-surface p-5 shadow-2xl">
            <h4 className="font-headline text-base font-bold text-on-surface">Reset Password</h4>
            <p className="mt-2 text-xs text-secondary">{passwordConstraintMessage}</p>
            <form className="mt-4 space-y-3" onSubmit={handleResetPassword}>
              <input
                type="password"
                className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                minLength={8}
                pattern="(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}"
                title={passwordConstraintMessage}
                placeholder="Enter new password"
              />
              {resetPasswordError && <p className="text-xs text-error">{resetPasswordError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeResetPassword} className="px-4 py-2 border border-outline/10 rounded-lg text-sm font-semibold hover:bg-surface-container">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary/95">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Users;
