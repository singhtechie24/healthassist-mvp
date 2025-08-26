import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { ThemeContext, type Theme } from './types';

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: Theme;
}

export function ThemeProvider({ children, initialTheme = 'light' }: ThemeProviderProps) {
  // Load theme from localStorage on initialization
  const getInitialTheme = (): Theme => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('healthassist-theme') as Theme;
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        return savedTheme;
      }
    }
    return initialTheme;
  };

  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('light');

  // Function to get system theme preference
  const getSystemTheme = (): 'light' | 'dark' => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  };

  // Update actual theme based on theme setting
  useEffect(() => {
    const updateActualTheme = () => {
      let newActualTheme: 'light' | 'dark';
      
      if (theme === 'system') {
        newActualTheme = getSystemTheme();
      } else {
        newActualTheme = theme;
      }
      
      console.log(`🔄 Theme update: ${theme} → actualTheme: ${newActualTheme}`);
      setActualTheme(newActualTheme);
    };

    updateActualTheme();

    // Listen for system theme changes when using 'system' mode
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => updateActualTheme();
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Force remove any existing theme classes first
    root.classList.remove('dark', 'light');
    
    if (actualTheme === 'dark') {
      root.classList.add('dark');
      console.log('🌙 Applied dark theme to document, classes:', root.classList.toString());
    } else {
      root.classList.add('light');
      console.log('🌞 Applied light theme to document, classes:', root.classList.toString());
    }
    
    // Force a style recalculation
    const style = getComputedStyle(root);
    console.log('📊 Background color:', style.backgroundColor);
  }, [actualTheme]);

  // Save theme to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('healthassist-theme', theme);
      console.log('💾 Saved theme to localStorage:', theme);
    }
  }, [theme]);

  const value = {
    theme,
    actualTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}


