/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Signup from './pages/Signup';
import NoteEditor from './pages/NoteEditor';
import CanvasEditor from './pages/CanvasEditor';
import Favourites from './pages/Favourites';
import Categories from './pages/Categories';
import Layout from './components/Layout';
import AppLockOverlay from './components/AppLockOverlay';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UIProvider, useUI } from './contexts/UIContext';
import { onConnectionError } from './lib/firebase';
import { AlertCircle, ExternalLink } from 'lucide-react';
import { useLocation } from 'react-router-dom';

function ThemeHandler() {
  const { theme } = useUI();
  const location = useLocation();

  React.useEffect(() => {
    const root = window.document.documentElement;
    const isEditorPage = location.pathname.startsWith('/note/') || location.pathname.startsWith('/canvas/');
    
    if (theme === 'dark' && !isEditorPage) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme, location.pathname]);

  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  return <>{children}</>;
}

function FirestoreErrorBanner() {
  const [error, setError] = React.useState<string | null>(null);
  const [isOffline, setIsOffline] = React.useState(!navigator.onLine);

  React.useEffect(() => {
    onConnectionError((msg) => setError(msg));
    
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // If we have a serious error (like permission denied or index missing), show it.
  // But if it's just "offline", we show a smaller, more polite indicator or nothing if it's transient.
  if (!error && !isOffline) return null;

  // Detect URL in error message for missing index
  const urlMatch = error?.match(/https:\/\/console\.firebase\.google\.com[^\s"]+/);
  const displayMessage = urlMatch ? error?.split(urlMatch[0])[0] : error;

  return (
    <div className={`border-b p-4 sticky top-0 z-[100] animate-in slide-in-from-top transition-colors duration-500 ${isOffline && !error ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'}`}>
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        <div className={`flex items-center gap-3 ${isOffline && !error ? 'text-amber-700' : 'text-red-700'}`}>
          <AlertCircle size={20} className="shrink-0" />
          <div className="text-sm font-medium leading-relaxed">
            {isOffline && !error ? "Working Offline - All changes will sync when you're back online." : displayMessage}
            {urlMatch && (
              <a 
                href={urlMatch[0]} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block mt-1 font-bold underline text-red-800"
              >
                Click here to create the missing index in Firebase Console
              </a>
            )}
          </div>
        </div>
        {!urlMatch && !isOffline && (
          <a 
            href="https://console.firebase.google.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1 text-sm font-bold text-red-800 hover:underline"
          >
            Firebase Console <ExternalLink size={14} />
          </a>
        )}
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <>
      <ThemeHandler />
      <FirestoreErrorBanner />
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <Home />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/note/:id?"
            element={
              <ProtectedRoute>
                <NoteEditor />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/canvas/:id?"
            element={
              <ProtectedRoute>
                <CanvasEditor />
              </ProtectedRoute>
            }
          />

          <Route
            path="/favourites"
            element={
              <ProtectedRoute>
                <Favourites />
              </ProtectedRoute>
            }
          />

          <Route
            path="/categories"
            element={
              <ProtectedRoute>
                <Categories />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AnimatePresence>
    </>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-[#FDFDFD] dark:bg-[#020617] text-[#1A1A1A] dark:text-white font-sans selection:bg-black selection:text-white transition-colors duration-500">
      <AuthProvider>
        <UIProvider>
          <AppLockOverlay>
            <AppRoutes />
          </AppLockOverlay>
        </UIProvider>
      </AuthProvider>
    </div>
  );
}

