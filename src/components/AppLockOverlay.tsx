import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useUI } from '../contexts/UIContext';
import { Lock, Grid, Hash, X, Check, RefreshCw } from 'lucide-react';
import PatternLock from './PatternLock';

export default function AppLockOverlay({ children }: { children: React.ReactNode }) {
  const { appLockConfig, accentColor } = useUI();
  // Initial state is locked if enabled
  const [isUnlocked, setIsUnlocked] = useState(!appLockConfig.isEnabled);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (appLockConfig.isEnabled) {
      setIsUnlocked(false);
    } else {
      setIsUnlocked(true);
    }
  }, [appLockConfig.isEnabled, appLockConfig.type]);

  const handleUnlock = (value: string) => {
    if (!value || !appLockConfig.value) return;
    
    if (value === appLockConfig.value) {
      setIsUnlocked(true);
      setInput("");
      setError(false);
    } else {
      setError(true);
      setInput("");
      if (window.navigator?.vibrate) window.navigator.vibrate(200);
      setTimeout(() => setError(false), 800);
    }
  };

  if (isUnlocked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white dark:bg-[#020617]">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm p-8 flex flex-col items-center"
      >
        <div className="w-20 h-20 rounded-[2rem] bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center mb-8 shadow-xl" style={{ color: accentColor }}>
          <Lock size={32} strokeWidth={2.5} />
        </div>

        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">App Locked</h2>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-12">Authorized Access Only</p>

        {appLockConfig.type === 'digit' && (
          <div className="w-full flex flex-col items-center gap-8">
            <div className="flex gap-4">
              {[0, 1, 2, 3, 4, 5].slice(0, appLockConfig.value?.length || 4).map((i) => (
                <motion.div 
                  key={i} 
                  animate={{ 
                    scale: input.length > i ? 1.25 : 1,
                    x: error ? [0, -10, 10, -10, 10, 0] : 0
                  }}
                  className={`w-4 h-4 rounded-full transition-all duration-300 ${input.length > i ? '' : 'bg-slate-100 dark:bg-slate-800'}`}
                  style={{ backgroundColor: input.length > i ? (error ? '#ef4444' : accentColor) : undefined }}
                />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4 w-full">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'].map((num, i) => (
                <button
                  key={i}
                  disabled={num === ''}
                  onClick={() => {
                    if (num === 'del') setInput(prev => prev.slice(0, -1));
                    else {
                      const newValue = input + num;
                      setInput(newValue);
                      if (newValue.length === (appLockConfig.value?.length || 4)) {
                        handleUnlock(newValue);
                      }
                    }
                  }}
                  className={`h-20 rounded-3xl text-2xl font-black transition-all active:scale-95 ${num === '' ? 'opacity-0' : 'bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-800'}`}
                >
                  {num === 'del' ? '←' : num}
                </button>
              ))}
            </div>
          </div>
        )}

        {appLockConfig.type === 'pattern' && (
          <div className="w-full flex flex-col items-center gap-12">
            <motion.div 
              animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
              className="p-6 bg-slate-50 dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-inner"
            >
              <PatternLock 
                size={280}
                accentColor={error ? '#ef4444' : accentColor}
                onComplete={handleUnlock}
              />
            </motion.div>
            
            <div className="flex flex-col items-center gap-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                {error ? 'Invalid Identity Sequence' : 'Draw Secure Pattern'}
              </p>
              {error && (
                <button 
                  onClick={() => { setError(false); setInput(""); }}
                  className="flex items-center gap-2 px-6 py-3 bg-rose-50 dark:bg-rose-900/20 rounded-full text-[10px] font-black uppercase tracking-widest text-rose-500"
                >
                  <RefreshCw size={12} strokeWidth={3} />
                  Try Again
                </button>
              )}
            </div>
          </div>
        )}

        <button 
          onClick={() => {
            if (window.confirm("Restore app access? This will remove your current lock settings.")) {
              localStorage.removeItem('notely-app-lock');
              window.location.reload();
            }
          }}
          className="mt-12 px-6 py-3 bg-slate-50 dark:bg-slate-900 ring-1 ring-slate-100 dark:ring-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 hover:ring-rose-500/20 transition-all active:scale-95"
        >
          Emergency Access Reset
        </button>
      </motion.div>
    </div>
  );
}
