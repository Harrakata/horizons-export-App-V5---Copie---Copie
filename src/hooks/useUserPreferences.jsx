import { useState, useEffect } from 'react';

const PREFERENCES_KEY = 'user_preferences';

const defaultPreferences = {
  theme: 'system', // 'light', 'dark', 'system'
  enableNotifications: true,
  autoValidatePointage: true, 
  pointageReminderDelay: 10, // minutes
  showPointageFeedback: true,
  audioEnabled: true,
  animationsEnabled: true,
  useGeolocation: false,
  language: 'fr',
  compactMode: false,
  lastUpdateTimestamp: null,
};

export const useUserPreferences = () => {
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Load preferences from localStorage on mount
  useEffect(() => {
    const loadPreferences = () => {
      try {
        const savedPrefs = localStorage.getItem(PREFERENCES_KEY);
        if (savedPrefs) {
          const parsedPrefs = JSON.parse(savedPrefs);
          setPreferences({ ...defaultPreferences, ...parsedPrefs });
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    
    loadPreferences();
  }, []);
  
  // Save preferences to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      try {
        const prefsToSave = {
          ...preferences,
          lastUpdateTimestamp: new Date().toISOString(),
        };
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefsToSave));
      } catch (error) {
        console.error('Error saving preferences:', error);
      }
    }
  }, [preferences, isLoaded]);
  
  // Apply theme based on preferences
  useEffect(() => {
    if (!isLoaded) return;
    
    const applyTheme = () => {
      const { theme } = preferences;
      const root = window.document.documentElement;
      
      if (theme === 'system') {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', systemPrefersDark);
      } else {
        root.classList.toggle('dark', theme === 'dark');
      }
    };
    
    applyTheme();
    
    // Listen for system theme changes
    if (preferences.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [preferences.theme, isLoaded]);
  
  // Update a single preference
  const updatePreference = (key, value) => {
    if (key in defaultPreferences) {
      setPreferences(prev => ({
        ...prev,
        [key]: value
      }));
    } else {
      console.warn(`Preference key "${key}" is not defined in default preferences.`);
    }
  };
  
  // Reset preferences to defaults
  const resetPreferences = () => {
    setPreferences(defaultPreferences);
  };
  
  return {
    preferences,
    isLoaded,
    updatePreference,
    resetPreferences,
  };
};

export default useUserPreferences; 