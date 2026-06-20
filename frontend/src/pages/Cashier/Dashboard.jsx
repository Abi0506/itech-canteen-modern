import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Search, IndianRupee, CreditCard, Wallet, PlusCircle, AlertCircle, RefreshCw } from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [searchRoll, setSearchRoll] = useState('');
  const [foundUser, setFoundUser] = useState(null);
  const [rechargeAmt, setRechargeAmt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { user } = useAuth();
  const canRechargeWallet = ['admin', 'superadmin'].includes(user?.role);

  const fetchStats = async () => {
    try {
      const res = await api.get('/cashier/dashboard-stats');
      setStats(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    setError('');
    setFoundUser(null);
    try {
      const res = await api.get(`/cashier/search-user?query=${searchRoll}`);
      setFoundUser(res.data);
    } catch (err) {
      setError('User not found. Check roll number or email.');
    }
  };

  const handleRecharge = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const res = await api.post(`/cashier/recharge-wallet?user_id=${foundUser.id}&amount=${rechargeAmt}`);
      setSuccess(`Successfully recharged ₹${parseFloat(rechargeAmt).toFixed(2)} to ${foundUser.roll_no}.`);
      setFoundUser({ ...foundUser, wallet_balance: res.data.new_balance });
      setRechargeAmt('');
      fetchStats();
    } catch (err) {
      setError('Recharge failed. Verify cashier permissions.');
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
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 font-body">
      <div>
        <h1 className="font-headline font-bold text-2xl text-on-surface">Cashier Dashboard</h1>
        <p className="text-secondary text-sm">Review today's service transactions and payment controls.</p>
      </div>

      {/* Daily Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="bg-surface-container-low border border-outline/10 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-outline text-[10px] font-bold uppercase tracking-wider">Total Sales Today</p>
            <p className="font-headline text-2xl font-black text-on-surface mt-1">₹{stats?.total_sales.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-primary/5 text-primary rounded-full">
            <IndianRupee size={20} />
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline/10 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-outline text-[10px] font-bold uppercase tracking-wider">Cash Collected</p>
            <p className="font-headline text-2xl font-black text-on-surface mt-1">₹{stats?.total_cash.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-primary/5 text-primary rounded-full">
            <IndianRupee size={20} />
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline/10 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-outline text-[10px] font-bold uppercase tracking-wider">UPI Collections</p>
            <p className="font-headline text-2xl font-black text-on-surface mt-1">₹{stats?.total_upi.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-primary/5 text-primary rounded-full">
            <CreditCard size={20} />
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline/10 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-outline text-[10px] font-bold uppercase tracking-wider">Wallet Deductions</p>
            <p className="font-headline text-2xl font-black text-on-surface mt-1">₹{stats?.total_wallet.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-primary/5 text-primary rounded-full">
            <Wallet size={20} />
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Wallet Recharge Panel */}
        <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4 lg:col-span-1">
          <h3 className="font-headline font-bold text-base text-on-surface flex items-center gap-2">
            <PlusCircle className="text-primary" size={20} />
            Wallet Recharge Desk
          </h3>
          <p className="text-secondary text-xs">Look up a customer or staff identifier and add credits when needed.</p>

          {!canRechargeWallet && (
            <div className="flex items-start gap-2 p-3 bg-surface-container-lowest border border-outline/10 rounded-xl text-secondary text-xs">
              <span className="material-symbols-outlined text-sm">info</span>
              <span>Recharge controls are reserved for superadmin access.</span>
            </div>
          )}

          {canRechargeWallet && error && (
            <div className="flex items-start gap-2 p-3 bg-error-container/20 border border-error/10 rounded-xl text-error text-xs">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {canRechargeWallet && success && (
            <div className="flex items-start gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 text-xs">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              <span>{success}</span>
            </div>
          )}

          {canRechargeWallet && (
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Enter roll no or email..."
                className="w-full pl-4 pr-10 py-2.5 bg-surface-container-lowest border border-outline/20 rounded-xl text-xs focus:ring-1 focus:ring-primary/20"
                value={searchRoll}
                onChange={(e) => setSearchRoll(e.target.value)}
                required
              />
              <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-outline">
                <Search size={16} />
              </button>
            </div>
          </form>
          )}

          {canRechargeWallet && foundUser && (
            <div className="border border-outline/10 p-4 rounded-xl space-y-3 bg-surface-container-lowest">
              <div className="text-xs">
                <p className="font-bold text-on-surface uppercase">{foundUser.roll_no}</p>
                <p className="text-outline">{foundUser.email}</p>
                <p className="text-primary font-black mt-1">Current Balance: ₹{foundUser.wallet_balance.toFixed(2)}</p>
              </div>

              <form onSubmit={handleRecharge} className="flex gap-2">
                <input
                  type="number"
                  placeholder="Amount ₹"
                  className="w-full px-3 py-2 bg-surface-container-low border border-outline/20 rounded-lg text-xs focus:ring-1 focus:ring-primary/20"
                  value={rechargeAmt}
                  onChange={(e) => setRechargeAmt(e.target.value)}
                  required
                />
                <button type="submit" className="px-3 bg-primary text-on-primary font-bold rounded-lg text-xs hover:bg-on-primary-fixed-variant transition-colors">
                  Topup
                </button>
              </form>
            </div>
          )}

        </div>

        {/* Recent Transactions List */}
        <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl lg:col-span-2 space-y-4">
          <h3 className="font-headline font-bold text-base text-on-surface flex items-center gap-2">
            <RefreshCw className="text-primary" size={18} />
            Recent Billing Transactions
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-outline/15 text-outline">
                  <th className="pb-3 font-bold">Bill No</th>
                  <th className="pb-3 font-bold">Amount</th>
                  <th className="pb-3 font-bold">Method</th>
                  <th className="pb-3 font-bold">Time</th>
                </tr>
              </thead>
              <tbody>
                {stats?.recent_transactions.map(tx => (
                  <tr key={tx.bill_number} className="border-b border-outline/10 hover:bg-surface-container-high transition-colors">
                    <td className="py-3 font-mono font-bold text-primary">#{tx.bill_number}</td>
                    <td className="py-3 font-bold text-on-surface">₹{tx.total_amount.toFixed(2)}</td>
                    <td className="py-3 uppercase text-secondary font-semibold">{tx.payment_method}</td>
                    <td className="py-3 text-outline">{new Date(tx.created_at).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
};

export default Dashboard;
