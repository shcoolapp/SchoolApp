import { createContext, useContext, useEffect, useState } from 'react';

const SettingsContext = createContext(null);

const DEFAULTS = { theme: 'dark', language: 'en', fontSize: 'medium' };
const FONT_SCALES = { small: 0.85, medium: 1, large: 1.35 };

function loadSettings() {
  try {
    const raw = localStorage.getItem('settings');
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    localStorage.setItem('settings', JSON.stringify(settings));
    document.documentElement.setAttribute('data-theme', settings.theme);
    document.documentElement.setAttribute('lang', settings.language);
    document.documentElement.setAttribute('dir', settings.language === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.style.setProperty('--font-scale', FONT_SCALES[settings.fontSize]);
  }, [settings]);

  function updateSetting(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
