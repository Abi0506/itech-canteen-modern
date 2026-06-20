import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Save, RefreshCw } from 'lucide-react';

const Settings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const fetchSettings = async () => {
    try {
      const res = await api.get('/admin/settings');
      setSettings(res.data);
    } catch (e) {
      console.error(e);
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
      setMsg('Settings updated successfully!');
    } catch (err) {
      setMsg('Failed to save settings.');
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 font-body">
      <div>
        <h1 className="font-headline font-bold text-2xl text-on-surface">Venue Configuration</h1>
        <p className="text-secondary text-sm">Control global rules, billing symbols, KDS behavior, and QR self-ordering workflows.</p>
      </div>

      {msg && (
        <div className="p-4 rounded-xl text-sm font-semibold bg-primary/5 text-primary border border-primary/10">
          {msg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Core Profile */}
        <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4">
          <h3 className="font-headline font-bold text-sm text-on-surface border-b border-outline/5 pb-2">Cafe Branding</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-secondary uppercase mb-1 font-body">Venue Name</label>
              <input
                type="text" required
                className="w-full p-3 bg-surface border border-outline/10 rounded-lg text-sm"
                value={settings.venue_name} onChange={(e) => handleChange('venue_name', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-secondary uppercase mb-1 font-body">Currency Symbol</label>
              <input
                type="text" required
                className="w-full p-3 bg-surface border border-outline/10 rounded-lg text-sm"
                value={settings.currency_symbol} onChange={(e) => handleChange('currency_symbol', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Self-Ordering Workflow */}
        <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4">
          <h3 className="font-headline font-bold text-sm text-on-surface border-b border-outline/5 pb-2">Customer Self-Ordering (QR)</h3>
          
          <div className="flex items-center justify-between py-2">
            <div>
              <h4 className="text-sm font-bold text-on-surface">Enable Self-Ordering Scan</h4>
              <p className="text-xs text-secondary">Allow customers to input/view orders from their smartphones.</p>
            </div>
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-outline/30 text-primary focus:ring-primary"
              checked={settings.self_ordering_enabled}
              onChange={(e) => handleChange('self_ordering_enabled', e.target.checked)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-secondary uppercase mb-1">Self-Ordering Mode</label>
              <select
                className="w-full p-3 bg-surface border border-outline/10 rounded-lg text-sm"
                value={settings.self_ordering_mode}
                onChange={(e) => handleChange('self_ordering_mode', e.target.value)}
              >
                <option value="online_ordering">Full Ordering (UPI checkout)</option>
                <option value="qr_menu">QR Menu Only (Read-only menu scan)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-secondary uppercase mb-1">PIN / Device Join lock</label>
              <select
                className="w-full p-3 bg-surface border border-outline/10 rounded-lg text-sm"
                value={settings.self_order_lock_mode}
                onChange={(e) => handleChange('self_order_lock_mode', e.target.value)}
              >
                <option value="device">Single Device lock (no login)</option>
                <option value="pin">4-Digit Table Session PIN (multi-device sync)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Kitchen auto advance */}
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
              checked={settings.kds_auto_advance}
              onChange={(e) => handleChange('kds_auto_advance', e.target.checked)}
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit" disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl hover:bg-primary/95 text-sm font-semibold transition-all shadow disabled:opacity-60"
          >
            {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
            Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;
