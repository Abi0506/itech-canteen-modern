import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

// Dark mode color overrides — injected as a <style> tag at runtime.
// This bypasses the need to rebuild Tailwind and works instantly.
const DARK_STYLE_ID = 'itech-dark-mode-overrides';

const DARK_CSS = `
  /* ── Dark Mode Overrides ──────────────────────────────── */
  html.dark body,
  html.dark {
    background-color: #1b1c1a !important;
    color: #e4e2de !important;
  }

  /* Surfaces */
  html.dark .bg-surface        { background-color: #1b1c1a !important; }
  html.dark .bg-background     { background-color: #1b1c1a !important; }
  html.dark .bg-surface-bright { background-color: #232422 !important; }
  html.dark .bg-surface-dim    { background-color: #141514 !important; }

  /* Surface containers */
  html.dark .bg-surface-container-lowest  { background-color: #0f0f0f !important; }
  html.dark .bg-surface-container-low     { background-color: #212220 !important; }
  html.dark .bg-surface-container         { background-color: #2b2c2a !important; }
  html.dark .bg-surface-container-high    { background-color: #323331 !important; }
  html.dark .bg-surface-container-highest { background-color: #3d3e3b !important; }

  /* Text */
  html.dark .text-on-surface         { color: #e4e2de !important; }
  html.dark .text-on-background      { color: #e4e2de !important; }
  html.dark .text-secondary          { color: #c8c6c6 !important; }
  html.dark .text-on-surface-variant { color: #d4b8b3 !important; }
  html.dark .text-outline            { color: #a08c87 !important; }

  /* Borders */
  html.dark .border-outline\\/10  { border-color: rgba(160,140,135,0.10) !important; }
  html.dark .border-outline\\/15  { border-color: rgba(160,140,135,0.15) !important; }
  html.dark .border-outline\\/20  { border-color: rgba(160,140,135,0.20) !important; }
  html.dark .border-outline\\/5   { border-color: rgba(160,140,135,0.05) !important; }
  html.dark .border-outline       { border-color: #a08c87 !important; }

  /* Inputs */
  html.dark input,
  html.dark textarea,
  html.dark select {
    background-color: #2b2c2a !important;
    color: #e4e2de !important;
    border-color: rgba(160,140,135,0.3) !important;
  }
  html.dark input::placeholder,
  html.dark textarea::placeholder {
    color: #a08c87 !important;
  }

  /* Navbar & Sidebar */
  html.dark nav.bg-surface,
  html.dark aside.bg-surface {
    background-color: #1b1c1a !important;
    border-color: rgba(160,140,135,0.1) !important;
  }

  /* Hover states */
  html.dark .hover\\:bg-surface-container-high:hover { background-color: #323331 !important; }
  html.dark .hover\\:bg-surface-container-highest:hover { background-color: #3d3e3b !important; }

  /* Tables */
  html.dark table { color: #e4e2de !important; }
  html.dark th    { color: #a08c87 !important; }
  html.dark tr.bg-surface-container-lowest { background-color: #0f0f0f !important; }

  /* Modals / Cards */
  html.dark .bg-surface-container-low  { background-color: #212220 !important; }
  html.dark .bg-surface-container      { background-color: #2b2c2a !important; }

  /* Toggle button itself */
  html.dark #theme-toggle-btn {
    background-color: #323331 !important;
    border-color: rgba(160,140,135,0.3) !important;
    color: #e4e2de !important;
  }

  /* Scrollbar */
  html.dark ::-webkit-scrollbar-track { background: #1b1c1a; }
  html.dark ::-webkit-scrollbar-thumb { background: #3d3e3b; border-radius: 4px; }
`;

function injectDarkStyles() {
  if (!document.getElementById(DARK_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = DARK_STYLE_ID;
    style.textContent = DARK_CSS;
    document.head.appendChild(style);
  }
}

function removeDarkStyles() {
  const el = document.getElementById(DARK_STYLE_ID);
  if (el) el.remove();
}

const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      injectDarkStyles();
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      removeDarkStyles();
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  // Apply saved theme on first mount
  useEffect(() => {
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark');
      injectDarkStyles();
    }
  }, []);

  return (
    <button
      id="theme-toggle-btn"
      onClick={() => setIsDark(prev => !prev)}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        width: '52px',
        height: '52px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        border: '1px solid rgba(137,114,109,0.25)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        transition: 'all 0.25s ease',
        backgroundColor: isDark ? '#323331' : '#ffffff',
        color: isDark ? '#ffb4a5' : '#9f402d',
      }}
      aria-label="Toggle Dark Mode"
    >
      {isDark
        ? <Sun size={22} strokeWidth={2} />
        : <Moon size={22} strokeWidth={2} />
      }
    </button>
  );
};

export default ThemeToggle;
