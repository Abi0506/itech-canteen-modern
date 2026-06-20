import React from 'react';

const CustomerDisplay = () => {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center space-y-4">
        <span className="material-symbols-outlined text-primary text-7xl block">display_settings</span>
        <h1 className="font-headline text-3xl font-bold text-on-surface">Customer Display</h1>
        <p className="text-secondary">This screen shows real-time order updates for customers.</p>
      </div>
    </div>
  );
};

export default CustomerDisplay;
