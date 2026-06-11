import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

interface UIContextType {
  isGridLayout: boolean;
  setIsGridLayout: (value: boolean) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  theme: 'light' | 'dark';
  setTheme: (value: 'light' | 'dark') => void;
  accentColor: string;
  setAccentColor: (value: string) => void;
  baseFontSize: number;
  setBaseFontSize: (value: number) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (value: boolean) => void;
  autoNotifications: boolean;
  setAutoNotifications: (value: boolean) => void;
  requestNotificationPermission: () => Promise<boolean>;
  scheduleReminder: (time: string, reason: string) => void;
  removeReminder: (id: string) => void;
  scheduledReminders: Array<{ id: string, time: string, reason: string }>;
  testNotification: () => void;
  autoSaveEnabled: boolean;
  setAutoSaveEnabled: (value: boolean) => void;
  appLockConfig: { type: 'none' | 'digit' | 'pattern', value?: string, isEnabled: boolean };
  setAppLockConfig: (config: { type: 'none' | 'digit' | 'pattern', value?: string, isEnabled: boolean }) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [isGridLayout, setIsGridLayout] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('notely-theme');
    return (saved === 'dark' || saved === 'light') ? saved : 'light';
  });
  const [accentColor, setAccentColor] = useState(() => {
    return localStorage.getItem('notely-accent') || '#4f46e5';
  });
  const [baseFontSize, setBaseFontSize] = useState<number>(() => {
    const saved = localStorage.getItem('notely-font-size');
    return saved ? parseInt(saved, 10) : 18;
  });

  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    // Default to true for better prototype experience, but respect saved preference
    const saved = localStorage.getItem('notely-notifications');
    return saved === null ? true : saved === 'true';
  });

  const [autoNotifications, setAutoNotifications] = useState(() => {
    const saved = localStorage.getItem('notely-auto-notif');
    return saved === null ? true : saved === 'true';
  });

  const [scheduledReminders, setScheduledReminders] = useState<Array<{ id: string, time: string, reason: string }>>(() => {
    const saved = localStorage.getItem('notely-scheduled-reminders');
    return saved ? JSON.parse(saved) : [];
  });

  const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => {
    const saved = localStorage.getItem('notely-auto-save');
    return saved === null ? true : saved === 'true';
  });

  const [appLockConfig, setAppLockConfig] = useState<{ type: 'none' | 'digit' | 'pattern', value?: string, isEnabled: boolean }>(() => {
    const saved = localStorage.getItem('notely-app-lock');
    return saved ? JSON.parse(saved) : { type: 'none', isEnabled: false };
  });

  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);

  // Load and sync settings with Firestore when user logs in
  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, 'users', user.uid);
    
    const unsubscribe = onSnapshot(userDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        
        setIsSyncing(true);
        if (data.theme && (data.theme === 'light' || data.theme === 'dark')) {
          setTheme(data.theme);
        }
        if (data.accentColor) {
          setAccentColor(data.accentColor);
        }
        if (data.baseFontSize) {
          setBaseFontSize(data.baseFontSize);
        }
        setTimeout(() => setIsSyncing(false), 200);
      }
    }, (error) => {
      console.warn("Error loading user preferences from Firestore:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Save settings to Firestore when they change locally
  useEffect(() => {
    if (!user || isSyncing) return;

    const saveSettings = async () => {
      const userDocRef = doc(db, 'users', user.uid);
      try {
        await setDoc(userDocRef, {
          theme,
          accentColor,
          baseFontSize,
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          photoURL: user.photoURL || null
        }, { merge: true });
      } catch (error) {
        console.warn("Failed to auto-save preferences to Firestore:", error);
      }
    };

    const timer = setTimeout(() => {
      saveSettings();
    }, 1000);

    return () => clearTimeout(timer);
  }, [theme, accentColor, baseFontSize, user, isSyncing]);
  
  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      console.warn("Notifications not supported in this browser");
      return false;
    }

    try {
      if (Notification.permission === "granted") {
        return true;
      }

      const permission = await Notification.requestPermission();
      return permission === "granted";
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    }
  };

  const scheduleReminder = (time: string, reason: string) => {
    const newReminder = {
      id: Math.random().toString(36).substr(2, 9),
      time,
      reason
    };
    const updated = [...scheduledReminders, newReminder];
    setScheduledReminders(updated);
    localStorage.setItem('notely-scheduled-reminders', JSON.stringify(updated));
  };

  const removeReminder = (id: string) => {
    const updated = scheduledReminders.filter(r => r.id !== id);
    setScheduledReminders(updated);
    localStorage.setItem('notely-scheduled-reminders', JSON.stringify(updated));
  };

  const sendNotification = async (title: string, options?: any) => {
    if (!notificationsEnabled) return;

    // Check if browser permission is actually granted
    if (!("Notification" in window)) return;
    
    if (Notification.permission !== "granted") {
      console.warn("Notification permission not granted. Current state:", Notification.permission);
      return;
    }

    try {
      // Try using Service Worker registration first (Required for Chrome and stable delivery)
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && 'showNotification' in registration) {
          await registration.showNotification(title, {
            ...options,
            icon: options?.icon || "/favicon.ico",
            badge: "/favicon.ico",
            vibrate: [100, 50, 100],
            data: {
              dateOfArrival: Date.now(),
              primaryKey: 1
            }
          });
          return;
        }
      }

      // Fallback to basic Notification constructor if SW is not ready
      new Notification(title, options);
    } catch (error) {
      console.error("Critical Notification Error:", error);
    }
  };

  const testNotification = () => {
    if (!notificationsEnabled) {
      alert("Please enable notifications first!");
      return;
    }
    sendNotification("Notely Test", {
      body: "This is how your notifications will look!",
      tag: "test-notification"
    });
  };

  // Check for auto-notification on mount/re-enable
  useEffect(() => {
    if (!notificationsEnabled || !autoNotifications) return;

    const checkAutoNotif = () => {
      const now = new Date();
      const today = now.toDateString();
      const lastSent = localStorage.getItem('notely-last-auto-notif-date');
      
      const nineAM = new Date();
      nineAM.setHours(9, 0, 0, 0);

      if (now >= nineAM && lastSent !== today) {
        sendNotification("Notely Daily", {
          body: "Good morning! Write down your thoughts for today.",
          tag: "daily-reminder"
        });
        localStorage.setItem('notely-last-auto-notif-date', today);
      }
    };

    checkAutoNotif();
    // Also check every 30 minutes in case they leave the tab open
    const interval = setInterval(checkAutoNotif, 1800000);
    return () => clearInterval(interval);
  }, [notificationsEnabled, autoNotifications]);

  // Check for scheduled notifications
  useEffect(() => {
    if (!notificationsEnabled) return;

    const interval = setInterval(() => {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      let triggered = false;
      const remainingReminders = scheduledReminders.filter((reminder) => {
        if (reminder.time === currentTime) {
          sendNotification("Notely Reminder", {
            body: reminder.reason,
            tag: `reminder-${reminder.id}`
          });
          triggered = true;
          return false;
        }
        return true;
      });

      if (triggered) {
        setScheduledReminders(remainingReminders);
        localStorage.setItem('notely-scheduled-reminders', JSON.stringify(remainingReminders));
      }
    }, 30000); // Check every 30 seconds for better accuracy

    return () => clearInterval(interval);
  }, [notificationsEnabled, scheduledReminders]);

  useEffect(() => {
    localStorage.setItem('notely-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('notely-font-size', baseFontSize.toString());
  }, [baseFontSize]);

  useEffect(() => {
    localStorage.setItem('notely-notifications', notificationsEnabled.toString());
  }, [notificationsEnabled]);

  useEffect(() => {
    localStorage.setItem('notely-auto-notif', autoNotifications.toString());
  }, [autoNotifications]);

  useEffect(() => {
    localStorage.setItem('notely-accent', accentColor);
    window.document.documentElement.style.setProperty('--accent-color', accentColor);
  }, [accentColor]);

  useEffect(() => {
    localStorage.setItem('notely-auto-save', autoSaveEnabled.toString());
  }, [autoSaveEnabled]);

  useEffect(() => {
    localStorage.setItem('notely-app-lock', JSON.stringify(appLockConfig));
  }, [appLockConfig]);

  return (
    <UIContext.Provider value={{ 
      isGridLayout, 
      setIsGridLayout, 
      searchQuery, 
      setSearchQuery,
      theme,
      setTheme,
      accentColor,
      setAccentColor,
      baseFontSize,
      setBaseFontSize,
      notificationsEnabled,
      setNotificationsEnabled,
      autoNotifications,
      setAutoNotifications,
      requestNotificationPermission,
      scheduleReminder,
      removeReminder,
      scheduledReminders,
      testNotification,
      autoSaveEnabled,
      setAutoSaveEnabled,
      appLockConfig,
      setAppLockConfig
    }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}
