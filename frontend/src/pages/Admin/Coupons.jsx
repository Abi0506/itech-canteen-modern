import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Plus, Trash2 } from 'lucide-react';

const Coupons = () => {
  const [coupons, setCoupons] = useState([]);
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('coupons');

  // Coupon state
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [code, setCode] = useState('');
  const [couponType, setCouponType] = useState('percent');
  const [couponVal, setCouponVal] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [cError, setCError] = useState('');

  // Promo state
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoName, setPromoName] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [promoType, setPromoType] = useState('percent');
  const [promoVal, setPromoVal] = useState('');
  const [pError, setPError] = useState('');

  const fetchData = async () => {
    try {
      const [cRes, pRes] = await Promise.all([
        api.get('/admin/coupons'),
        api.get('/admin/promotions')
      ]);
      setCoupons(cRes.data);
      setPromos(pRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const extractApiError = (err, fallback) => {
    const detail = err?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return detail
        .map((d) => (typeof d === 'string' ? d : d?.msg || 'Validation error'))
        .join(', ');
    }
    return fallback;
  };

  const handleAddCoupon = async (e) => {
    e.preventDefault();
    setCError('');

    const normalizedCode = code.trim().toUpperCase();
    const parsedValue = Number(couponVal);
    const parsedMaxUses = maxUses ? Number(maxUses) : null;

    if (!normalizedCode) {
      setCError('Coupon code is required');
      return;
    }

    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      setCError('Coupon value must be greater than 0');
      return;
    }

    if (couponType === 'percent' && parsedValue > 100) {
      setCError('Percentage discount cannot be greater than 100');
      return;
    }

    if (parsedMaxUses !== null && (!Number.isInteger(parsedMaxUses) || parsedMaxUses <= 0)) {
      setCError('Max uses must be a positive whole number');
      return;
    }

    if (validFrom && validUntil && validUntil < validFrom) {
      setCError('Valid until date cannot be earlier than valid from date');
      return;
    }

    try {
      await api.post('/admin/coupons', {
        code: normalizedCode,
        discount_type: couponType,
        value: parsedValue,
        max_uses: parsedMaxUses,
        valid_from: validFrom || null,
        valid_until: validUntil || null
      });
      setShowCouponModal(false);
      setCode('');
      setCouponVal('');
      setMaxUses('');
      setValidFrom('');
      setValidUntil('');
      fetchData();
    } catch (err) {
      setCError(extractApiError(err, 'Failed to create coupon'));
    }
  };

  const handleAddPromo = async (e) => {
    e.preventDefault();
    setPError('');
    try {
      await api.post('/admin/promotions', {
        name: promoName,
        scope: 'order',
        min_order_amount: Number(minOrder),
        discount_type: promoType,
        value: Number(promoVal)
      });
      setShowPromoModal(false);
      setPromoName('');
      setMinOrder('');
      setPromoVal('');
      fetchData();
    } catch (err) {
      setPError(err.response?.data?.detail || 'Failed to create promotion');
    }
  };

  const handleDeleteCoupon = async (id) => {
    if (!window.confirm('Delete coupon?')) return;
    try {
      await api.delete(`/admin/coupons/${id}`);
      fetchData();
    } catch (e) {
      alert('Failed to delete coupon');
    }
  };

  const handleDeletePromo = async (id) => {
    if (!window.confirm('Delete promotion?')) return;
    try {
      await api.delete(`/admin/promotions/${id}`);
      fetchData();
    } catch (e) {
      alert('Failed to delete promotion');
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
          <h1 className="font-headline font-bold text-2xl text-on-surface">Coupons & Campaigns</h1>
          <p className="text-secondary text-sm">Configure billing discounts via manually entered coupon codes or automated bill-value promotions.</p>
        </div>
        <div>
          {tab === 'coupons' ? (
            <button
              onClick={() => setShowCouponModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl hover:bg-primary/95 text-sm font-semibold transition-all shadow"
            >
              <Plus size={18} />
              Add Coupon
            </button>
          ) : (
            <button
              onClick={() => setShowPromoModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl hover:bg-primary/95 text-sm font-semibold transition-all shadow"
            >
              <Plus size={18} />
              Create Promo Campaign
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-outline/10 gap-4">
        <button
          onClick={() => setTab('coupons')}
          className={`py-3 px-1 text-sm font-semibold border-b-2 transition-all ${
            tab === 'coupons' ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-primary'
          }`}
        >
          Coupon Codes
        </button>
        <button
          onClick={() => setTab('promos')}
          className={`py-3 px-1 text-sm font-semibold border-b-2 transition-all ${
            tab === 'promos' ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-primary'
          }`}
        >
          Automated Promotions
        </button>
      </div>

      {/* Coupons View */}
      {tab === 'coupons' && (
        <div className="overflow-x-auto bg-surface-container-low border border-outline/10 rounded-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline/10 text-outline text-xs uppercase tracking-wider">
                <th className="p-4 font-bold">Code</th>
                <th className="p-4 font-bold">Type</th>
                <th className="p-4 font-bold">Value</th>
                <th className="p-4 font-bold text-center">Uses</th>
                <th className="p-4 font-bold text-center">Status</th>
                <th className="p-4 font-bold text-right">Delete</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-b border-outline/10 text-sm hover:bg-surface-container-high transition-colors">
                  <td className="p-4 font-bold text-primary uppercase">{c.code}</td>
                  <td className="p-4 text-secondary uppercase">{c.discount_type}</td>
                  <td className="p-4 font-bold">
                    {c.discount_type === 'percent' ? `${c.value}%` : `Rs.${c.value}`}
                  </td>
                  <td className="p-4 text-center text-secondary">
                    {c.used_count} / {c.max_uses || '∞'}
                  </td>
                  <td className="p-4 text-center">
                    {c.is_active ? (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800">Active</span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-error-container text-on-error-container">Inactive</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleDeleteCoupon(c.id)}
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

      {/* Promos View */}
      {tab === 'promos' && (
        <div className="overflow-x-auto bg-surface-container-low border border-outline/10 rounded-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline/10 text-outline text-xs uppercase tracking-wider">
                <th className="p-4 font-bold">Name</th>
                <th className="p-4 font-bold">Min Bill Amount</th>
                <th className="p-4 font-bold">Type</th>
                <th className="p-4 font-bold">Discount Value</th>
                <th className="p-4 font-bold text-center">Status</th>
                <th className="p-4 font-bold text-right">Delete</th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id} className="border-b border-outline/10 text-sm hover:bg-surface-container-high transition-colors">
                  <td className="p-4 font-bold text-on-surface">{p.name}</td>
                  <td className="p-4 text-secondary">Rs.{p.min_order_amount}</td>
                  <td className="p-4 text-secondary uppercase">{p.discount_type}</td>
                  <td className="p-4 font-bold">
                    {p.discount_type === 'percent' ? `${p.value}%` : `Rs.${p.value}`}
                  </td>
                  <td className="p-4 text-center">
                    {p.is_active ? (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800">Active</span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-error-container text-on-error-container">Inactive</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleDeletePromo(p.id)}
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

      {/* Coupon Modal */}
      {showCouponModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline/10 p-6 rounded-2xl w-full max-w-md space-y-4">
            <h3 className="font-headline font-bold text-lg text-on-surface">Create New Coupon</h3>
            <form onSubmit={handleAddCoupon} className="space-y-4">
              {cError && <p className="text-xs text-error font-semibold bg-error/10 p-3 rounded">{cError}</p>}
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Coupon Code</label>
                <input
                  type="text" required
                  placeholder="e.g. WELCOME20"
                  className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm uppercase"
                  value={code} onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary uppercase mb-1">Discount Type</label>
                  <select
                    className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                    value={couponType} onChange={(e) => setCouponType(e.target.value)}
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="fixed">Fixed (Rs.)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary uppercase mb-1">Value</label>
                  <input
                    type="number" required min="1"
                    className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                    step="0.01"
                    max={couponType === 'percent' ? 100 : undefined}
                    value={couponVal} onChange={(e) => setCouponVal(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Max Uses (Optional)</label>
                <input
                  type="number" min="1"
                  className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                  value={maxUses} onChange={(e) => setMaxUses(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary uppercase mb-1">Valid From (Optional)</label>
                  <input
                    type="date"
                    className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                    value={validFrom} onChange={(e) => setValidFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary uppercase mb-1">Valid Until (Optional)</label>
                  <input
                    type="date"
                    className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                    value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCouponModal(false)}
                  className="px-4 py-2 border border-outline/10 rounded-lg text-sm font-semibold hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary/95"
                >
                  Save Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Promo Modal */}
      {showPromoModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline/10 p-6 rounded-2xl w-full max-w-md space-y-4">
            <h3 className="font-headline font-bold text-lg text-on-surface">Create Automated Campaign</h3>
            {pError && <p className="text-xs text-error">{pError}</p>}
            <form onSubmit={handleAddPromo} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Campaign Name</label>
                <input
                  type="text" required
                  placeholder="e.g. Bulk discount 10%"
                  className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                  value={promoName} onChange={(e) => setPromoName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Min Bill Threshold (Rs.)</label>
                <input
                  type="number" required min="1"
                  placeholder="e.g. 500"
                  className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                  value={minOrder} onChange={(e) => setMinOrder(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary uppercase mb-1">Discount Type</label>
                  <select
                    className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                    value={promoType} onChange={(e) => setPromoType(e.target.value)}
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="fixed">Fixed (Rs.)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary uppercase mb-1">Discount Value</label>
                  <input
                    type="number" required min="1"
                    className="w-full p-3 bg-surface-container-low border border-outline/10 rounded-lg text-sm"
                    value={promoVal} onChange={(e) => setPromoVal(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPromoModal(false)}
                  className="px-4 py-2 border border-outline/10 rounded-lg text-sm font-semibold hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary/95"
                >
                  Save Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Coupons;
