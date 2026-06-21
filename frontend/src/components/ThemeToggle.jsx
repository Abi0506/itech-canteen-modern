import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains('dark') ||
           localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return (
    <button
      onClick={() => setIsDark(!isDark)}
      className="fixed bottom-6 right-6 z-50 p-4 rounded-full bg-surface-container-high border border-outline/20 text-on-surface shadow-2xl hover:bg-surface-container-highest transition-all duration-300 editorial-shadow focus:outline-none"
      aria-label="Toggle Dark Mode"
    >
      {isDark ? <Sun size={24} className="text-primary" /> : <Moon size={24} className="text-primary" />}
    </button>
  );
};

export default ThemeToggle;
