import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { Save, RefreshCw, CheckCircle2, CircleDashed } from 'lucide-react';

const requiredConfig = [
  { key: 'venue_name', label: 'Venue Name' },
  { key: 'currency_symbol', label: 'Currency Symbol' },
  { key: 'tax_label', label: 'Tax Label' },
  { key: 'session_timeout_minutes', label: 'Session Timeout' }
];

const optionalConfig = [
  { key: 'self_ordering_enabled', label: 'Self-Ordering Access' },
  { key: 'self_ordering_mode', label: 'Self-Ordering Mode' },
  { key: 'self_order_lock_mode', label: 'Join Lock Mode' },
  { key: 'menu_background_color', label: 'Menu Background Color' },
  { key: 'menu_background_image_url', label: 'Menu Background Image URL' },
  { key: 'receipt_footer_text', label: 'Receipt Footer Text' },
  { key: 'kds_auto_advance', label: 'KDS Auto-Advance' },
  { key: 'razorpay_key_id', label: 'Razorpay Key ID' },
  { key: 'razorpay_key_secret', label: 'Razorpay Secret' }
];

const hasValue = (value) => {
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number') return value > 0;
  return String(value || '').trim().length > 0;
};

const Settings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('success');

  const fetchSettings = async () => {
    try {
      const res = await api.get('/admin/settings');
      setSettings(res.data);
    } catch (e) {
      console.error(e);
      setMsgType('error');
      setMsg('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (key, val) => {
    setSettings((prev) => ({
      ...prev,
      [key]: val
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await api.put('/admin/settings', settings);
      setMsgType('success');
      setMsg('Configuration updated successfully.');
    } catch (err) {
      setMsgType('error');
      setMsg(err.response?.data?.detail || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <p className="text-secondary">Failed to load settings. Please try again.</p>
        <button onClick={fetchSettings} className="px-4 py-2 bg-primary text-on-primary rounded-xl text-sm font-semibold shadow">
          Retry
        </button>
      </div>
    );
  }

  const completedRequired = requiredConfig.filter((field) => hasValue(settings[field.key]));
  const pendingOptional = optionalConfig.filter((field) => !hasValue(settings[field.key]));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6 font-body">
      <div>
        <h1 className="font-headline font-bold text-2xl text-on-surface">Venue Configuration</h1>
        <p className="text-secondary text-sm">Control global rules, billing symbols, KDS behavior, and QR self-ordering workflows.</p>
      </div>

      {msg && (
        <div className={`p-4 rounded-xl text-sm font-semibold border ${
          msgType === 'success'
            ? 'bg-primary/5 text-primary border-primary/10'
            : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_0.9fr] gap-6">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4">
            <h3 className="font-headline font-bold text-sm text-on-surface border-b border-outline/5 pb-2">Cafe Branding</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1 font-body">Venue Name</label>
                <input
                  type="text"
                  required
                  className="w-full p-3 bg-surface border border-outline/10 rounded-lg text-sm"
                  value={settings.venue_name || ''}
                  onChange={(e) => handleChange('venue_name', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1 font-body">Currency Symbol</label>
                <input
                  type="text"
                  required
                  className="w-full p-3 bg-surface border border-outline/10 rounded-lg text-sm"
                  value={settings.currency_symbol || ''}
                  onChange={(e) => handleChange('currency_symbol', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Tax Label</label>
                <input
                  type="text"
                  required
                  className="w-full p-3 bg-surface border border-outline/10 rounded-lg text-sm"
                  value={settings.tax_label || ''}
                  onChange={(e) => handleChange('tax_label', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Session Timeout (Minutes)</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="w-full p-3 bg-surface border border-outline/10 rounded-lg text-sm"
                  value={settings.session_timeout_minutes || 15}
                  onChange={(e) => handleChange('session_timeout_minutes', Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4">
            <h3 className="font-headline font-bold text-sm text-on-surface border-b border-outline/5 pb-2">Customer Self-Ordering (QR)</h3>

            <div className="flex items-center justify-between py-2">
              <div>
                <h4 className="text-sm font-bold text-on-surface">Enable Self-Ordering Scan</h4>
                <p className="text-xs text-secondary">Allow customers to input or view orders from their smartphones.</p>
              </div>
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-outline/30 text-primary focus:ring-primary"
                checked={Boolean(settings.self_ordering_enabled)}
                onChange={(e) => handleChange('self_ordering_enabled', e.target.checked)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Self-Ordering Mode</label>
                <select
                  className="w-full p-3 bg-surface border border-outline/10 rounded-lg text-sm"
                  value={settings.self_ordering_mode || 'online_ordering'}
                  onChange={(e) => handleChange('self_ordering_mode', e.target.value)}
                >
                  <option value="online_ordering">Full Ordering (UPI checkout)</option>
                  <option value="qr_menu">QR Menu Only (Read-only menu scan)</option>
                  <option value="both">Menu + Ordering Combined</option>
                  <option value="kiosk">Counter Kiosk Experience</option>
                  <option value="qr_table">QR Table Session Ordering</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">PIN / Device Join Lock</label>
                <select
                  className="w-full p-3 bg-surface border border-outline/10 rounded-lg text-sm"
                  value={settings.self_order_lock_mode || 'pin'}
                  onChange={(e) => handleChange('self_order_lock_mode', e.target.value)}
                >
                  <option value="device">Single Device Lock</option>
                  <option value="pin">4-Digit Session PIN</option>
                  <option value="none">No Join Lock</option>
                  <option value="otp">OTP Based Join</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4">
            <h3 className="font-headline font-bold text-sm text-on-surface border-b border-outline/5 pb-2">Menu & Receipt Presentation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Menu Background Color</label>
                <input
                  type="text"
                  className="w-full p-3 bg-surface border border-outline/10 rounded-lg text-sm"
                  value={settings.menu_background_color || '#FFFFFF'}
                  onChange={(e) => handleChange('menu_background_color', e.target.value)}
                  placeholder="#FFFFFF"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Menu Background Image URL</label>
                <input
                  type="text"
                  className="w-full p-3 bg-surface border border-outline/10 rounded-lg text-sm"
                  value={settings.menu_background_image_url || ''}
                  onChange={(e) => handleChange('menu_background_image_url', e.target.value)}
                  placeholder="https://example.com/background.jpg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-secondary uppercase mb-1">Receipt Footer Text</label>
              <textarea
                rows="3"
                className="w-full p-3 bg-surface border border-outline/10 rounded-lg text-sm"
                value={settings.receipt_footer_text || ''}
                onChange={(e) => handleChange('receipt_footer_text', e.target.value)}
                placeholder="Thank you for visiting"
              />
            </div>
          </div>

          <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4">
            <h3 className="font-headline font-bold text-sm text-on-surface border-b border-outline/5 pb-2">KDS Kitchen Management</h3>
            <div className="flex items-center justify-between py-2">
              <div>
                <h4 className="text-sm font-bold text-on-surface">Auto-Advance Tickets</h4>
                <p className="text-xs text-secondary">Instantly push tickets to KDS without waiter manual screening.</p>
              </div>
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-outline/30 text-primary focus:ring-primary"
                checked={Boolean(settings.kds_auto_advance)}
                onChange={(e) => handleChange('kds_auto_advance', e.target.checked)}
              />
            </div>
          </div>

          <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4">
            <h3 className="font-headline font-bold text-sm text-on-surface border-b border-outline/5 pb-2">Payment Gateway (Razorpay)</h3>
            <p className="text-xs text-secondary mb-2">Configure online payments for Self-Order and Cashier online collections.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Razorpay Key ID</label>
                <input
                  type="text"
                  className="w-full p-3 bg-surface border border-outline/10 rounded-lg text-sm"
                  value={settings.razorpay_key_id || ''}
                  onChange={(e) => handleChange('razorpay_key_id', e.target.value)}
                  placeholder="rzp_test_..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase mb-1">Razorpay Key Secret</label>
                <input
                  type="password"
                  className="w-full p-3 bg-surface border border-outline/10 rounded-lg text-sm"
                  value={settings.razorpay_key_secret || ''}
                  onChange={(e) => handleChange('razorpay_key_secret', e.target.value)}
                  placeholder="Secret key..."
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl hover:bg-primary/95 text-sm font-semibold transition-all shadow disabled:opacity-60"
            >
              {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
              Save Configuration
            </button>
          </div>
        </form>

        <div className="space-y-6">
          <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4">
            <h3 className="font-headline font-bold text-sm text-on-surface">Configuration Coverage</h3>
            <p className="text-sm text-secondary">Required and optional details classified from the venue config page.</p>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Required</p>
              <div className="space-y-3">
                {requiredConfig.map((field) => (
                  <div key={field.key} className="flex items-center justify-between rounded-xl border border-outline/10 bg-surface p-3">
                    <span className="text-sm text-on-surface">{field.label}</span>
                    {hasValue(settings[field.key]) ? (
                      <CheckCircle2 size={18} className="text-emerald-600" />
                    ) : (
                      <CircleDashed size={18} className="text-amber-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Optional</p>
              <div className="space-y-3">
                {optionalConfig.map((field) => (
                  <div key={field.key} className="flex items-center justify-between rounded-xl border border-outline/10 bg-surface p-3">
                    <span className="text-sm text-on-surface">{field.label}</span>
                    {hasValue(settings[field.key]) ? (
                      <CheckCircle2 size={18} className="text-emerald-600" />
                    ) : (
                      <CircleDashed size={18} className="text-outline" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-primary/5 border border-primary/10 p-6 rounded-2xl space-y-3">
            <h3 className="font-headline font-bold text-sm text-on-surface">What was missing</h3>
            <p className="text-sm text-secondary">
              This page now includes tax label, session timeout, menu presentation settings, and receipt footer text in addition to the existing self-ordering and KDS controls.
            </p>
            <p className="text-sm text-secondary">
              {completedRequired.length}/{requiredConfig.length} required fields are currently filled. {pendingOptional.length} optional items are still available if you want a more complete setup.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
