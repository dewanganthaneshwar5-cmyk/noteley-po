/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactNode, useState } from 'react';
import { Search, LayoutGrid, List, Plus, Brush, Mic, LogOut, X, Heart, FolderPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { isGridLayout, setIsGridLayout, searchQuery, setSearchQuery, theme, accentColor } = useUI();
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-[#020617] transition-colors duration-500">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
        {!isSearching ? (
          <h1 className="text-2xl font-black tracking-tight" style={{ color: accentColor }}>
            Notely
          </h1>
        ) : (
          <div className="flex-1 max-w-md mr-4 relative">
            <input 
              autoFocus
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('');
                  setIsSearching(false);
                }
              }}
              placeholder="Search your notes..."
              className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl pl-4 pr-10 py-2 text-sm focus:ring-2 transition-all font-bold dark:text-white"
              style={{ '--tw-ring-color': accentColor } as any}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                title="Clear Search"
              >
                <X size={14} strokeWidth={3} />
              </button>
            )}
          </div>
        )}
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              setIsSearching(!isSearching);
              if (isSearching) setSearchQuery('');
            }}
            className={cn(
              "p-2.5 rounded-xl transition-all active:scale-90 shadow-sm",
              isSearching ? "text-white" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
            )}
            style={{ backgroundColor: isSearching ? accentColor : undefined }}
            title="Search Notes"
          >
            <Search size={22} strokeWidth={2.5} />
          </button>
          
          <button 
            onClick={() => setIsGridLayout(!isGridLayout)}
            className="p-2.5 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-90 border border-slate-100 dark:border-slate-800 shadow-sm"
            title={isGridLayout ? "List View" : "Grid View"}
          >
            {isGridLayout ? <List size={22} strokeWidth={2.5} /> : <LayoutGrid size={22} strokeWidth={2.5} />}
          </button>
          
          <div className="relative">
            <button 
              onClick={() => navigate('/profile')}
              className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-800 shadow-sm flex items-center justify-center overflow-hidden hover:scale-110 active:scale-95 transition-all"
              title="View Profile"
            >
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: accentColor }}>
                  {getInitials(user?.displayName || null)}
                </div>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Areas */}
      <main className="flex-1 overflow-y-auto pt-24 pb-28 px-6 lg:px-8">
        {children}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl h-20 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 sm:px-10 shadow-[0_-4px_30px_-4px_rgba(0,0,0,0.1)]">
        <div className="flex items-center gap-6 sm:gap-8">
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/favourites')}
            className="p-2 transition-colors relative"
            style={{ color: location.pathname === '/favourites' ? accentColor : '#94a3b8' }}
          >
            <Heart size={26} className={cn(location.pathname === '/favourites' && "fill-current")} />
            {location.pathname === '/favourites' && (
              <motion.div layoutId="nav-dot" className="absolute -bottom-1 left-1/2 -translateX-1/2 w-1 h-1 rounded-full bg-current" />
            )}
          </motion.button>

          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/canvas/new')}
            className="p-2 transition-colors"
            style={{ color: location.pathname.includes('canvas') ? accentColor : '#94a3b8' }}
          >
            <Brush size={26} />
          </motion.button>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 -top-10">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/note/new')}
            className="w-20 h-20 rounded-full text-white flex items-center justify-center shadow-2xl border-[6px] border-white dark:border-slate-800 group transition-all"
            style={{ backgroundColor: accentColor, boxShadow: `0 20px 25px -5px ${accentColor}40` }}
          >
            <Plus size={36} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-500" />
          </motion.button>
        </div>

        <div className="flex items-center gap-6 sm:gap-8">
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/note/new?type=voice')}
            className="p-2 transition-colors"
            style={{ color: '#94a3b8' }}
          >
            <Mic size={26} />
          </motion.button>

          <motion.button 
             whileTap={{ scale: 0.9 }}
             onClick={() => navigate('/categories')}
             className="p-2 transition-colors"
             style={{ color: location.pathname === '/categories' ? accentColor : '#94a3b8' }}
          >
            <FolderPlus size={26} />
          </motion.button>
        </div>
      </nav>
    </div>
  );
}
