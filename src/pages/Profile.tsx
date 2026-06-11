/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { DoorOpen, Mail, User, ArrowLeft, Calendar, Clock, ShieldCheck, ChevronDown, Palette, Sun, Moon, Bell, ToggleLeft, ToggleRight, Save, Lock, Hash, Grid, ChevronRight, X } from 'lucide-react';
import PatternLock from '../components/PatternLock';

const ACCENT_COLORS = [
  { name: 'Indigo', hex: '#4f46e5' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Rose', hex: '#e11d48' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Sky', hex: '#0284c7' },
  { name: 'Violet', hex: '#7c3aed' },
];

export default function Profile() {
  const { user } = useAuth();
  const { 
    theme, setTheme, 
    accentColor, setAccentColor, 
    baseFontSize, setBaseFontSize,
    notificationsEnabled, setNotificationsEnabled,
    autoNotifications, setAutoNotifications,
    requestNotificationPermission,
    scheduleReminder,
    removeReminder,
    scheduledReminders,
    testNotification,
    autoSaveEnabled,
    setAutoSaveEnabled,
    appLockConfig,
    setAppLockConfig
  } = useUI();
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);
  const [showThemeSettings, setShowThemeSettings] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showAutoSaveSettings, setShowAutoSaveSettings] = useState(false);
  const [showAppLockSettings, setShowAppLockSettings] = useState(false);
  const [showLockSetup, setShowLockSetup] = useState<{ type: 'digit' | 'pattern' | null }>({ type: null });
  const [setupStage, setSetupStage] = useState<'initial' | 'confirm'>('initial');
  const [isVerifyingRemove, setIsVerifyingRemove] = useState<{ type: 'none' | 'digit' | 'pattern' | null }>({ type: null });
  const [lockInput, setLockInput] = useState("");
  const [firstInput, setFirstInput] = useState("");
  const [verifyInput, setVerifyInput] = useState("");
  const [showSchedulerModal, setShowSchedulerModal] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleReason, setScheduleReason] = useState("");

  const NOTIFICATION_REASONS = [
    "Important Meeting",
    "Note Review",
    "Deadline Reminder",
    "Brainstorming Session",
    "Daily Journaling",
    "Task Completion",
    "Project Planning",
    "Study Session",
    "Creative Writing",
    "Personal Reflection"
  ];

  const handleMasterToggle = async () => {
    const newState = !notificationsEnabled;
    setNotificationsEnabled(newState);
    
    if (newState) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        // If in iframe, suggest opening in new tab
        const isIframe = window.self !== window.top;
        if (isIframe) {
          console.log("Notifications might be blocked in preview. Try opening in a new tab.");
        }
      }
    }
  };

  const handleSchedule = () => {
    if (!scheduleTime || !scheduleReason) return;
    scheduleReminder(scheduleTime, scheduleReason);
    setShowSchedulerModal(false);
    setScheduleTime("");
    setScheduleReason("");
    alert("Reminder Scheduled Successfully!");
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleToggleLock = (type: 'digit' | 'pattern') => {
    if (appLockConfig.isEnabled) {
      // If any lock is enabled, we need to verify the CURRENT lock before doing anything
      setIsVerifyingRemove({ type: appLockConfig.type });
      setVerifyInput("");
    } else {
      setShowLockSetup({ type });
      setSetupStage('initial');
      setLockInput("");
      setFirstInput("");
    }
  };

  const handleVerifyToRemove = async (input?: string) => {
    if (input === appLockConfig.value) {
      setAppLockConfig({ type: 'none', isEnabled: false });
      setIsVerifyingRemove({ type: null });
      setVerifyInput("");
      alert("Identity Verified. Lock Removed.");
    } else {
      alert("Incorrect Identity Sequence. Access Denied.");
      setVerifyInput("");
    }
  };

  const handleSaveLock = () => {
    if (!lockInput) return;
    
    if (setupStage === 'initial') {
      setFirstInput(lockInput);
      setSetupStage('confirm');
      setLockInput("");
      return;
    }

    if (lockInput === firstInput) {
      setAppLockConfig({ 
        type: showLockSetup.type as any, 
        isEnabled: true, 
        value: lockInput 
      });
      setShowLockSetup({ type: null });
      setLockInput("");
      setFirstInput("");
      setSetupStage('initial');
      alert(`${showLockSetup.type?.toUpperCase()} Lock set successfully!`);
    } else {
      alert("Sequences do not match. Restarting setup.");
      setSetupStage('initial');
      setLockInput("");
      setFirstInput("");
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not Available';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto p-6 md:p-12 min-h-screen flex flex-col items-center transition-colors duration-500 dark:bg-[#020617]"
    >
      <header className="w-full mb-8 flex items-center justify-between">
        <button 
          onClick={() => navigate('/')}
          className="p-3 bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 rounded-2xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all active:scale-95"
          style={{ color: accentColor }}
        >
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-600">Account Security</span>
        <div className="w-11" />
      </header>

      <div className="w-full flex flex-col items-center text-center relative max-w-md">
        <div className="w-32 h-32 rounded-[2.5rem] border-4 border-white dark:border-slate-800 shadow-2xl flex items-center justify-center overflow-hidden mb-8 mt-4 group transition-transform hover:scale-105 duration-500">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white text-3xl font-black italic" style={{ backgroundColor: accentColor }}>
              {getInitials(user?.displayName || null)}
            </div>
          )}
        </div>

        <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
          Hello, {user?.displayName || 'User'}!
        </h2>
        <p className="text-slate-400 dark:text-slate-500 font-bold text-sm tracking-wide mb-2">Welcome back to your workspace</p>
        <p className="font-bold text-xs mb-10 px-4 py-1.5 rounded-full border" style={{ color: accentColor, backgroundColor: `${accentColor}15`, borderColor: `${accentColor}30` }}>{user?.email}</p>
        
        <div className="w-full space-y-6">
          {/* Account Info Section */}
          <div className="flex flex-col items-center gap-4">
            <button 
              onClick={() => setShowDetails(!showDetails)}
              className="group flex flex-col items-center gap-2 transition-all active:scale-95"
            >
              <div className="w-12 h-12 bg-white dark:bg-slate-900 shadow-lg shadow-slate-200/50 dark:shadow-none rounded-2xl flex items-center justify-center border border-slate-100 dark:border-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 transition-colors" style={{ color: accentColor }}>
                <ShieldCheck size={24} strokeWidth={2.5} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Account Security Info</span>
                <motion.div
                  animate={{ rotate: showDetails ? 180 : 0 }}
                  className="text-slate-400"
                >
                  <ChevronDown size={14} strokeWidth={3} />
                </motion.div>
              </div>
            </button>
            
            <AnimatePresence>
              {showDetails && (
                <motion.div 
                  initial={{ height: 0, opacity: 0, scale: 0.95 }}
                  animate={{ height: 'auto', opacity: 1, scale: 1 }}
                  exit={{ height: 0, opacity: 0, scale: 0.95 }}
                  className="w-full overflow-hidden space-y-3 pt-2"
                >
                  <div className="grid grid-cols-1 gap-3">
                    {/* Full Name */}
                    <div className="flex items-center gap-4 p-4 bg-white/80 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center" style={{ color: accentColor }}>
                        <User size={18} strokeWidth={2.5} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Profile Identity</p>
                        <p className="text-slate-900 dark:text-white font-bold text-sm">{user?.displayName || 'Authorized User'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Join Date */}
                      <div className="p-4 bg-white/80 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm text-left">
                        <div className="flex items-center gap-2 mb-2 text-emerald-600">
                          <Calendar size={14} strokeWidth={3} />
                          <span className="text-[9px] font-black uppercase tracking-widest opacity-70">Entry Date</span>
                        </div>
                        <p className="text-slate-900 dark:text-white font-bold text-[11px] leading-tight">
                          {formatDate(user?.metadata.creationTime)}
                        </p>
                      </div>

                      {/* Last Visit */}
                      <div className="p-4 bg-white/80 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm text-left">
                        <div className="flex items-center gap-2 mb-2 text-indigo-600">
                          <Clock size={14} strokeWidth={3} />
                          <span className="text-[9px] font-black uppercase tracking-widest opacity-70">Recent Access</span>
                        </div>
                        <p className="text-slate-900 dark:text-white font-bold text-[11px] leading-tight">
                          {formatDate(user?.metadata.lastSignInTime)}
                        </p>
                        <p className="text-[9px] font-bold text-indigo-400 mt-0.5">
                          at {formatTime(user?.metadata.lastSignInTime)}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Theme Settings Section */}
          <div className="flex flex-col items-center gap-4">
            <button 
              onClick={() => setShowThemeSettings(!showThemeSettings)}
              className="group flex flex-col items-center gap-2 transition-all active:scale-95"
            >
              <div className="w-12 h-12 bg-white dark:bg-slate-900 shadow-lg shadow-slate-200/50 dark:shadow-none rounded-2xl flex items-center justify-center text-indigo-500 border border-slate-100 dark:border-slate-800 group-hover:bg-indigo-50 dark:group-hover:bg-slate-800 transition-colors" style={{ color: accentColor }}>
                <Palette size={24} strokeWidth={2.5} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Appearance Settings</span>
                <motion.div
                  animate={{ rotate: showThemeSettings ? 180 : 0 }}
                  className="text-slate-400"
                >
                  <ChevronDown size={14} strokeWidth={3} />
                </motion.div>
              </div>
            </button>
            
            <AnimatePresence>
              {showThemeSettings && (
                <motion.div 
                  initial={{ height: 0, opacity: 0, scale: 0.95 }}
                  animate={{ height: 'auto', opacity: 1, scale: 1 }}
                  exit={{ height: 0, opacity: 0, scale: 0.95 }}
                  className="w-full overflow-hidden space-y-4 pt-2"
                >
                  {/* Theme Mode Toggles */}
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setTheme('light')}
                      className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-3xl border-2 transition-all ${theme === 'light' ? 'bg-white border-indigo-500 shadow-lg shadow-indigo-100' : 'bg-slate-100 dark:bg-slate-900 border-transparent text-slate-400'}`}
                      style={{ borderColor: theme === 'light' ? accentColor : 'transparent' }}
                    >
                      <Sun size={18} strokeWidth={theme === 'light' ? 3 : 2} className={theme === 'light' ? '' : ''} style={{ color: theme === 'light' ? accentColor : undefined }} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-slate-900' : ''}`}>Light</span>
                    </button>
                    <button 
                      onClick={() => setTheme('dark')}
                      className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-3xl border-2 transition-all ${theme === 'dark' ? 'bg-slate-800 border-indigo-500 shadow-lg shadow-indigo-900/20' : 'bg-slate-100 dark:bg-slate-900 border-transparent text-slate-400'}`}
                      style={{ borderColor: theme === 'dark' ? accentColor : 'transparent' }}
                    >
                      <Moon size={18} strokeWidth={theme === 'dark' ? 3 : 2} className={theme === 'dark' ? '' : ''} style={{ color: theme === 'dark' ? accentColor : undefined }} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : ''}`}>Dark</span>
                    </button>
                  </div>

                  {/* Accent Color Picker */}
                  <div className="p-5 bg-white/80 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Accent Color</span>
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: accentColor }} />
                    </div>
                    <div className="flex justify-between items-center px-1">
                      {ACCENT_COLORS.map((color) => (
                        <button
                          key={color.hex}
                          onClick={() => setAccentColor(color.hex)}
                          className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 active:scale-90 ${accentColor === color.hex ? 'border-slate-900 dark:border-white scale-110 shadow-lg' : 'border-white dark:border-slate-800 shadow-sm'}`}
                          style={{ backgroundColor: color.hex }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Font Size Settings */}
                  <div className="p-5 bg-white/80 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Note Font Size</span>
                      <span className="text-[10px] font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md" style={{ color: accentColor }}>{baseFontSize}px</span>
                    </div>
                    <div className="px-1 flex items-center gap-4">
                      <span className="text-xs font-bold text-slate-400">A</span>
                      <input 
                        type="range"
                        min="12"
                        max="32"
                        step="1"
                        value={baseFontSize}
                        onChange={(e) => setBaseFontSize(parseInt(e.target.value))}
                        className="flex-1 h-1.5 appearance-none bg-slate-200 dark:bg-slate-800 rounded-lg outline-none cursor-pointer"
                        style={{ accentColor: accentColor }}
                      />
                      <span className="text-xl font-bold text-slate-400">A</span>
                    </div>
                    <p className="text-[9px] font-medium text-slate-400 italic text-center">Adjust the default text size for your notes and editor.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

                  {/* Notification Settings Section */}
          <div className="flex flex-col items-center gap-4">
            <button 
              onClick={() => setShowNotificationSettings(!showNotificationSettings)}
              className="group flex flex-col items-center gap-2 transition-all active:scale-95"
            >
              <div className="w-12 h-12 bg-white dark:bg-slate-900 shadow-lg shadow-slate-200/50 dark:shadow-none rounded-2xl flex items-center justify-center border border-slate-100 dark:border-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 transition-colors" style={{ color: accentColor }}>
                <Bell size={24} strokeWidth={2.5} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Notification Settings</span>
                <motion.div
                  animate={{ rotate: showNotificationSettings ? 180 : 0 }}
                  className="text-slate-400"
                >
                  <ChevronDown size={14} strokeWidth={3} />
                </motion.div>
              </div>
            </button>
            
            <AnimatePresence>
              {showNotificationSettings && (
                <motion.div 
                  initial={{ height: 0, opacity: 0, scale: 0.95 }}
                  animate={{ height: 'auto', opacity: 1, scale: 1 }}
                  exit={{ height: 0, opacity: 0, scale: 0.95 }}
                  className="w-full overflow-hidden space-y-3 pt-2"
                >
                  {/* Master Toggle */}
                  <div className="p-5 bg-white/80 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-left">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">Push Notifications</p>
                        <p className="text-[9px] font-medium text-slate-400 italic font-mono uppercase">System Core Status</p>
                      </div>
                      <button 
                        onClick={handleMasterToggle}
                        className="w-16 h-8 rounded-full relative transition-all duration-300 active:scale-95"
                        style={{ backgroundColor: notificationsEnabled ? `${accentColor}20` : '#f1f5f9' }}
                      >
                        <motion.div 
                          className="absolute top-1 left-1 w-6 h-6 rounded-full shadow-md flex items-center justify-center cursor-pointer"
                          animate={{ x: notificationsEnabled ? 32 : 0 }}
                          style={{ backgroundColor: notificationsEnabled ? accentColor : '#94a3b8' }}
                        >
                          {notificationsEnabled ? <Bell size={10} color="white" /> : <div className="w-1.5 h-1.5 rounded-full bg-white/50" />}
                        </motion.div>
                      </button>
                    </div>

                    {!notificationsEnabled && (
                      <p className="text-[8px] font-bold text-slate-400 text-center uppercase tracking-widest bg-slate-50 dark:bg-slate-800/50 py-2 rounded-xl">
                        Switch On To Activate Features
                      </p>
                    )}

                    {notificationsEnabled && window.self !== window.top && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                        <p className="text-[8px] leading-relaxed font-bold text-amber-600 dark:text-amber-400 uppercase tracking-tight">
                          Note: notifications require browser permission. If you don't see them, 
                          <button onClick={() => window.open(window.location.href)} className="underline ml-1">Open in new tab</button>.
                        </p>
                      </div>
                    )}

                    {notificationsEnabled && (
                      <button 
                        onClick={testNotification}
                        className="w-full py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-100 dark:border-slate-800"
                      >
                        Send Test Notification
                      </button>
                    )}

                    <AnimatePresence>
                      {notificationsEnabled && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800"
                        >
                          {/* Manual Scheduler Trigger */}
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <div className="text-left">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Custom Reminder</p>
                                <p className="text-[8px] font-medium text-slate-400">Schedule alerts for specific tasks</p>
                              </div>
                              <button 
                                onClick={() => setShowSchedulerModal(true)}
                                className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest text-white shadow-lg active:scale-95 transition-all"
                                style={{ backgroundColor: accentColor }}
                              >
                                Set Reminder
                              </button>
                            </div>
                            
                            {/* Active Reminders List */}
                            {scheduledReminders.length > 0 && (
                              <div className="mt-2 space-y-1.5">
                                <p className="text-[7px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Active Reminders</p>
                                {scheduledReminders.map((reminder) => (
                                  <div key={reminder.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-xl group/item">
                                    <div className="flex flex-col">
                                      <span className="text-[9px] font-black text-slate-900 dark:text-white">{reminder.time}</span>
                                      <span className="text-[8px] font-medium text-slate-400 truncate max-w-[120px]">{reminder.reason}</span>
                                    </div>
                                    <button 
                                      onClick={() => removeReminder(reminder.id)}
                                      className="opacity-0 group-hover/item:opacity-100 text-[8px] font-black text-rose-500 uppercase transition-opacity"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Auto Toggle */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                            <div className="text-left">
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Daily Note Prompt</p>
                              <p className="text-[8px] font-medium text-slate-400">Automatic reminder to start your day</p>
                            </div>
                            <button 
                              onClick={() => setAutoNotifications(!autoNotifications)}
                              className="transition-all active:scale-90"
                              style={{ color: autoNotifications ? accentColor : '#94a3b8' }}
                            >
                              {autoNotifications ? <ToggleRight size={28} strokeWidth={2.5} /> : <ToggleLeft size={28} strokeWidth={2.5} />}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Auto Save Settings Section */}
          <div className="flex flex-col items-center gap-4">
            <button 
              onClick={() => setShowAutoSaveSettings(!showAutoSaveSettings)}
              className="group flex flex-col items-center gap-2 transition-all active:scale-95"
            >
              <div className="w-12 h-12 bg-white dark:bg-slate-900 shadow-lg shadow-slate-200/50 dark:shadow-none rounded-2xl flex items-center justify-center border border-slate-100 dark:border-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 transition-colors" style={{ color: accentColor }}>
                <Save size={24} strokeWidth={2.5} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Data Persistence</span>
                <motion.div
                  animate={{ rotate: showAutoSaveSettings ? 180 : 0 }}
                  className="text-slate-400"
                >
                  <ChevronDown size={14} strokeWidth={3} />
                </motion.div>
              </div>
            </button>
            
            <AnimatePresence>
              {showAutoSaveSettings && (
                <motion.div 
                  initial={{ height: 0, opacity: 0, scale: 0.95 }}
                  animate={{ height: 'auto', opacity: 1, scale: 1 }}
                  exit={{ height: 0, opacity: 0, scale: 0.95 }}
                  className="w-full overflow-hidden space-y-3 pt-2"
                >
                  <div className="p-5 bg-white/80 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="text-left">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">Intelligent Auto-Save</p>
                        <p className="text-[9px] font-medium text-slate-400 italic">Never lose a single character</p>
                      </div>
                      <button 
                        onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
                        className="transition-all active:scale-90"
                        style={{ color: autoSaveEnabled ? accentColor : '#94a3b8' }}
                      >
                        {autoSaveEnabled ? <ToggleRight size={32} strokeWidth={2.5} /> : <ToggleLeft size={32} strokeWidth={2.5} />}
                      </button>
                    </div>
                    {autoSaveEnabled && (
                      <p className="mt-3 text-[8px] font-bold text-center text-emerald-500 uppercase tracking-widest bg-emerald-50 dark:bg-emerald-900/20 py-2 rounded-xl">
                        Real-time Content Sync Active
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* App Lock Settings Section */}
          <div className="flex flex-col items-center gap-4">
            <button 
              onClick={() => setShowAppLockSettings(!showAppLockSettings)}
              className="group flex flex-col items-center gap-2 transition-all active:scale-95"
            >
              <div className="w-12 h-12 bg-white dark:bg-slate-900 shadow-lg shadow-slate-200/50 dark:shadow-none rounded-2xl flex items-center justify-center border border-slate-100 dark:border-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 transition-colors" style={{ color: accentColor }}>
                <Lock size={24} strokeWidth={2.5} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Privacy Shield</span>
                <motion.div
                  animate={{ rotate: showAppLockSettings ? 180 : 0 }}
                  className="text-slate-400"
                >
                  <ChevronDown size={14} strokeWidth={3} />
                </motion.div>
              </div>
            </button>
            
            <AnimatePresence>
              {showAppLockSettings && (
                <motion.div 
                  initial={{ height: 0, opacity: 0, scale: 0.95 }}
                  animate={{ height: 'auto', opacity: 1, scale: 1 }}
                  exit={{ height: 0, opacity: 0, scale: 0.95 }}
                  className="w-full overflow-hidden space-y-3 pt-2"
                >
                  <div className="p-5 bg-white/80 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 text-center mb-4">Choose Protection Layer</p>
                    
                    <div className="space-y-2">
                      {/* Digit Lock */}
                      <button 
                        onClick={() => handleToggleLock('digit')}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${appLockConfig.isEnabled && appLockConfig.type === 'digit' ? 'bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-500' : 'bg-slate-50 dark:bg-slate-800 border-2 border-transparent'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${appLockConfig.isEnabled && appLockConfig.type === 'digit' ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                            <Hash size={16} strokeWidth={2.5} />
                          </div>
                          <div className="text-left">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">Digit PIN Lock</p>
                            <p className="text-[8px] font-bold text-slate-400">4 or 6 digit number code</p>
                          </div>
                        </div>
                        {appLockConfig.isEnabled && appLockConfig.type === 'digit' ? <ToggleRight size={28} /> : <ChevronRight size={14} className="text-slate-400" />}
                      </button>

                      {/* Pattern Lock */}
                      <button 
                        onClick={() => handleToggleLock('pattern')}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${appLockConfig.isEnabled && appLockConfig.type === 'pattern' ? 'bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-500' : 'bg-slate-50 dark:bg-slate-800 border-2 border-transparent'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${appLockConfig.isEnabled && appLockConfig.type === 'pattern' ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                            <Grid size={16} strokeWidth={2.5} />
                          </div>
                          <div className="text-left">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">Pattern Unlock</p>
                            <p className="text-[8px] font-bold text-slate-400">Visual grid connection</p>
                          </div>
                        </div>
                        {appLockConfig.isEnabled && appLockConfig.type === 'pattern' ? <ToggleRight size={28} /> : <ChevronRight size={14} className="text-slate-400" />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {isVerifyingRemove.type && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsVerifyingRemove({ type: null })}
                  className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl"
                />
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden p-8 border border-white/10"
                >
                  <button 
                    onClick={() => setIsVerifyingRemove({ type: null })}
                    className="absolute top-6 right-6 p-2 text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <X size={20} strokeWidth={3} />
                  </button>

                  <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-500 mb-4">
                      <ShieldCheck size={32} strokeWidth={2.5} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Security Check</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Verify to change settings</p>
                  </div>

                  <div className="space-y-6">
                    {isVerifyingRemove.type === 'digit' && (
                      <div className="flex flex-col items-center gap-6">
                        <div className="flex gap-3">
                          {[0, 1, 2, 3].map((i) => (
                            <div 
                              key={i} 
                              className={`w-4 h-4 rounded-full transition-all duration-300 ${verifyInput.length > i ? 'scale-125' : 'bg-slate-100 dark:bg-slate-800'}`}
                              style={{ backgroundColor: verifyInput.length > i ? accentColor : undefined }}
                            />
                          ))}
                        </div>
                        <div className="grid grid-cols-3 gap-3 w-full">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'].map((num, i) => (
                            <button
                              key={i}
                              disabled={num === ''}
                              onClick={() => {
                                if (num === 'del') setVerifyInput(prev => prev.slice(0, -1));
                                else {
                                  const newValue = verifyInput + num;
                                  setVerifyInput(newValue);
                                  if (newValue.length === (appLockConfig.value?.length || 4)) {
                                    handleVerifyToRemove(newValue);
                                  }
                                }
                              }}
                              className={`h-16 rounded-2xl text-xl font-black transition-all active:scale-90 ${num === '' ? 'opacity-0' : 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                            >
                              {num === 'del' ? '←' : num}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}                    {isVerifyingRemove.type === 'pattern' && (
                      <div className="flex flex-col items-center gap-6">
                        <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-[3rem] shadow-inner">
                          <PatternLock 
                            size={240}
                            accentColor={accentColor}
                            onComplete={(pattern) => handleVerifyToRemove(pattern)}
                          />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Draw Current Pattern</p>
                      </div>
                    )}

                    <div className="pt-2">
                       <button 
                        onClick={() => setIsVerifyingRemove({ type: null })}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all text-center"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showLockSetup.type && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowLockSetup({ type: null })}
                  className="absolute inset-0 bg-black/60 backdrop-blur-md"
                />
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden p-8 border border-white/20"
                >
                  <button 
                    onClick={() => setShowLockSetup({ type: null })}
                    className="absolute top-6 right-6 p-2 text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <X size={20} strokeWidth={3} />
                  </button>

                  <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 tracking-tight text-center">
                    {setupStage === 'initial' ? `Set ${showLockSetup.type?.toUpperCase()} Lock` : 'Confirm Identity Sequence'}
                  </h3>
                  
                  <div className="space-y-6">
                    {showLockSetup.type === 'digit' && (
                      <div className="flex flex-col items-center gap-6">
                        <div className="flex gap-3">
                          {[0, 1, 2, 3].map((i) => (
                            <div 
                              key={i} 
                              className={`w-4 h-4 rounded-full transition-all duration-300 ${lockInput.length > i ? 'scale-125' : 'bg-slate-100 dark:bg-slate-800'}`}
                              style={{ backgroundColor: lockInput.length > i ? accentColor : undefined }}
                            />
                          ))}
                        </div>
                        <div className="grid grid-cols-3 gap-3 w-full">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'].map((num, i) => (
                            <button
                              key={i}
                              disabled={num === ''}
                              onClick={() => {
                                if (num === 'del') setLockInput(prev => prev.slice(0, -1));
                                else if (lockInput.length < 6) setLockInput(prev => prev + num);
                              }}
                              className={`h-16 rounded-2xl text-xl font-black transition-all active:scale-90 ${num === '' ? 'opacity-0' : 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                            >
                              {num === 'del' ? '←' : num}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {showLockSetup.type === 'pattern' && (
                      <div className="flex flex-col items-center gap-6">
                        <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-[3rem] shadow-inner">
                          <PatternLock 
                            size={240}
                            accentColor={accentColor}
                            onComplete={(pattern) => setLockInput(pattern)}
                          />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {lockInput ? 'Pattern Captured' : 'Draw your pattern'}
                          </p>
                          {lockInput && (
                            <button 
                              onClick={() => setLockInput("")}
                              className="text-[9px] font-black uppercase text-rose-500 tracking-widest bg-rose-50 dark:bg-rose-900/20 px-3 py-1 rounded-full"
                            >
                              Reset Drawing
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <button 
                      onClick={handleSaveLock}
                      disabled={showLockSetup.type === 'digit' ? lockInput.length < 4 : !lockInput}
                      className="w-full p-5 text-white rounded-3xl text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-xl disabled:opacity-50 disabled:scale-100"
                      style={{ backgroundColor: accentColor }}
                    >
                      {setupStage === 'initial' ? 'Save Sequence' : 'Confirm & Activate Shield'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showSchedulerModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowSchedulerModal(false)}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden p-8 border border-white/20"
                >
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 tracking-tight text-center">Schedule Notification</h3>
                  
                  <div className="space-y-5">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-2">Preferred Time</p>
                      <input 
                        type="time" 
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                        style={{ accentColor }}
                      />
                    </div>
                    
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-2">Reason for Alert</p>
                      <select 
                        value={scheduleReason}
                        onChange={(e) => setScheduleReason(e.target.value)}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                      >
                        <option value="">Select a reason...</option>
                        {NOTIFICATION_REASONS.map(reason => (
                          <option key={reason} value={reason}>{reason}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-3 pt-2">
                       <button 
                        onClick={() => setShowSchedulerModal(false)}
                        className="flex-1 p-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleSchedule}
                        className="flex-2 p-4 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg"
                        style={{ backgroundColor: accentColor }}
                      >
                        Set Reminder
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 p-5 bg-rose-600 text-white rounded-[2rem] transition-all font-black uppercase tracking-widest text-[10px] active:scale-[0.98] group shadow-xl shadow-rose-200"
          >
            <DoorOpen size={18} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
            Sign Out Securely
          </button>
        </div>
      </div>

      <p className="text-center mt-12 text-[10px] text-slate-400 font-black uppercase tracking-[0.4em] opacity-50">
        Secured Workspace Environment
      </p>
    </motion.div>
  );
}
