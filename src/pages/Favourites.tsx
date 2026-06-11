/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { motion, AnimatePresence } from 'motion/react';
import { Note } from '../types';
import { ChevronLeft, Heart, Trash2, Lock, FolderPlus, EyeOff, FolderMinus } from 'lucide-react';
import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { useNavigate } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import NoteLockModal from '../components/NoteLockModal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Favourites() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { accentColor } = useUI();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [longPressedNote, setLongPressedNote] = useState<Note | null>(null);
  const [lockModal, setLockModal] = useState<{ 
    isOpen: boolean; 
    mode: 'lock' | 'unlock'; 
    note: Note | null;
    action: 'unlock_permanent' | 'access'
  }>({ isOpen: false, mode: 'lock', note: null, action: 'access' });
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notes'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter((note: any) => note.isFavourite === true) as Note[];
      setNotes(notesData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notes');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const stripHtml = (html: string) => {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this note? This action cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'notes', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notes/${id}`);
    }
  };

  const toggleFavourite = async (id: string, current: boolean = false) => {
    try {
      await updateDoc(doc(db, 'notes', id), {
        isFavourite: !current,
        updatedAt: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notes/${id}`);
    }
  };

  const handleLockConfirm = async (pin: string) => {
    if (!lockModal.note) return;
    
    try {
      if (lockModal.mode === 'lock') {
        await updateDoc(doc(db, 'notes', lockModal.note.id), {
          isLocked: true,
          pin: pin,
          updatedAt: Date.now()
        });
      } else {
        if (lockModal.action === 'unlock_permanent') {
          await updateDoc(doc(db, 'notes', lockModal.note.id), {
            isLocked: false,
            updatedAt: Date.now()
          });
        } else if (lockModal.action === 'access') {
          navigate(lockModal.note.type === 'drawing' ? `/canvas/${lockModal.note.id}` : `/note/${lockModal.note.id}`);
        }
      }
      setLockModal(prev => ({ ...prev, isOpen: false }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notes/${lockModal.note.id}`);
    }
  };

  const handleSetCategory = async (id: string, currentCategory?: string) => {
    if (currentCategory) {
      if (window.confirm(`Remove this note from "${currentCategory}" category?`)) {
        await updateDoc(doc(db, 'notes', id), {
          category: null,
          updatedAt: Date.now()
        });
      }
      return;
    }

    const category = window.prompt("Enter category name:");
    if (category === null) return;
    try {
      await updateDoc(doc(db, 'notes', id), {
        category: category.trim(),
        updatedAt: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notes/${id}`);
    }
  };

  const startLongPress = (note: Note) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      setLongPressedNote(note);
      if (window.navigator?.vibrate) window.navigator.vibrate(10);
    }, 200); // Faster long press
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div 
          className="w-12 h-12 border-4 border-slate-100 dark:border-slate-800 rounded-full animate-spin"
          style={{ borderTopColor: accentColor }}
        />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading Favourites...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <header className="flex items-center gap-6 mb-12">
        <button 
          onClick={() => navigate('/')}
          className="p-4 bg-white hover:bg-slate-50 rounded-3xl transition-all shadow-lg active:scale-90 border border-slate-100 text-slate-900"
          style={{ color: accentColor }}
        >
          <ChevronLeft size={24} strokeWidth={3} />
        </button>
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Your Favourites</h1>
          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mt-1">
            {notes.length} Special Notes
          </p>
        </div>
      </header>

      {notes.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-32 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200"
        >
          <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center shadow-xl mb-6">
            <Heart size={32} className="text-slate-200" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">No Favourites Yet</h2>
          <p className="text-slate-400 font-medium max-w-xs text-center leading-relaxed">
            Long press on any note card and tap the heart icon to save it here.
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {notes.map((note, index) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, type: "spring", stiffness: 100 }}
              onPointerDown={() => startLongPress(note)}
              onPointerUp={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onClick={() => {
                if (!longPressedNote) {
                  // Always navigate, let the editor handle its own lock screen if needed
                  navigate(note.type === 'drawing' ? `/canvas/${note.id}` : `/note/${note.id}`);
                }
              }}
              className={cn(
                "group relative border shadow-xl hover:shadow-2xl transition-all cursor-pointer overflow-hidden flex flex-col hover:-translate-y-1 active:scale-95",
                "p-8 rounded-[2.5rem] h-auto min-h-[200px] border-black/5"
              )}
              style={{ backgroundColor: note.color || '#F1F5F9' }}
            >
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-black text-xl text-slate-900 line-clamp-1">{note.title || "Untitled"}</h3>
                  <Heart size={16} className="fill-rose-500 text-rose-500 shrink-0" />
                </div>

                {note.category && (
                  <div className="mb-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black bg-white/40 text-slate-900/60 uppercase tracking-widest">
                      {note.category}
                    </span>
                  </div>
                )}

                <div className={cn(
                  "leading-relaxed font-bold text-slate-900/60 text-sm line-clamp-4",
                  note.isLocked && "blur-md select-none"
                )}>
                  {note.isLocked ? (
                    <div className="flex flex-col items-center justify-center p-4 rounded-2xl gap-2 mt-2">
                      <EyeOff size={24} className="text-slate-400" />
                      <p className="text-[10px] italic uppercase tracking-widest text-slate-400">Locked Content</p>
                    </div>
                  ) : (
                    note.type === 'drawing' ? (
                      <div className="mt-2 rounded-xl overflow-hidden border border-black/5 bg-white/50 h-32">
                        <img src={note.content} alt="Drawing Preview" className="w-full h-full object-cover opacity-80" />
                      </div>
                    ) : (
                      stripHtml(note.content)
                    )
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modern Pop-up Menu */}
      <AnimatePresence>
        {longPressedNote && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLongPressedNote(null)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 400 }}
              className="relative w-full max-w-sm bg-white rounded-[3rem] overflow-hidden shadow-2xl border border-white/20"
            >
              <div className="p-8 pb-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Note Actions</h4>
                <p className="text-xl font-black text-slate-900 line-clamp-1">{longPressedNote.title || "Untitled"}</p>
              </div>

              <div className="px-4 pb-8 space-y-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavourite(longPressedNote.id, longPressedNote.isFavourite);
                    setLongPressedNote(null);
                  }}
                  className="w-full flex items-center gap-4 p-5 rounded-[1.8rem] bg-slate-50 hover:bg-slate-100 transition-all group"
                >
                  <div className={cn(
                    "p-3 rounded-2xl shadow-sm bg-white text-rose-500"
                  )}>
                    <Heart size={20} className={cn(longPressedNote.isFavourite && "fill-rose-500")} strokeWidth={2.5} />
                  </div>
                  <span className="font-black text-slate-700 uppercase tracking-widest text-xs">Remove from Favourites</span>
                </button>

                 <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSetCategory(longPressedNote.id, longPressedNote.category);
                    setLongPressedNote(null);
                  }}
                  className="w-full flex items-center gap-4 p-5 rounded-[1.8rem] bg-slate-50 hover:bg-slate-100 transition-all group"
                >
                  <div className="p-3 bg-white rounded-2xl text-slate-400 shadow-sm transition-all group-active:scale-90">
                    {longPressedNote.category ? <FolderMinus size={20} strokeWidth={2.5} /> : <FolderPlus size={20} strokeWidth={2.5} />}
                  </div>
                  <span className="font-black text-slate-700 uppercase tracking-widest text-xs">
                    {longPressedNote.category ? "Un-category" : "Category"}
                  </span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLockModal({ 
                      isOpen: true, 
                      mode: longPressedNote.isLocked ? 'unlock' : 'lock', 
                      note: longPressedNote,
                      action: longPressedNote.isLocked ? 'unlock_permanent' : 'access' 
                    });
                    setLongPressedNote(null);
                  }}
                  className="w-full flex items-center gap-4 p-5 rounded-[1.8rem] bg-slate-50 hover:bg-slate-100 transition-all group"
                >
                  <div className={cn(
                    "p-3 rounded-2xl shadow-sm transition-all group-active:scale-90",
                    longPressedNote.isLocked ? "bg-indigo-50 text-indigo-500" : "bg-white text-slate-400"
                  )}
                  style={{ backgroundColor: longPressedNote.isLocked ? `${accentColor}15` : undefined, color: longPressedNote.isLocked ? accentColor : undefined }}
                  >
                    <Lock size={20} strokeWidth={2.5} />
                  </div>
                  <span className="font-black text-slate-700 uppercase tracking-widest text-xs">
                    {longPressedNote.isLocked ? "Unlock Note" : "Lock Note"}
                  </span>
                </button>

                <div className="pt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(longPressedNote.id);
                      setLongPressedNote(null);
                    }}
                    className="w-full flex items-center gap-4 p-5 rounded-[1.8rem] bg-rose-500 text-white hover:bg-rose-600 transition-all shadow-xl shadow-rose-500/20 group"
                  >
                    <div className="p-3 bg-white/20 rounded-2xl transition-all group-active:scale-90">
                      <Trash2 size={20} strokeWidth={2.5} />
                    </div>
                    <span className="font-black uppercase tracking-[0.2em] text-xs">Delete Note</span>
                  </button>
                </div>
              </div>
              
              <div className="p-4 text-center">
                <button 
                  onClick={() => setLongPressedNote(null)}
                  className="text-slate-400 font-black uppercase tracking-widest text-[9px]"
                >
                  Tap anywhere to close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <NoteLockModal
        isOpen={lockModal.isOpen}
        mode={lockModal.mode}
        onClose={() => setLockModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleLockConfirm}
        title={lockModal.note?.title}
        expectedPin={lockModal.mode === 'unlock' ? lockModal.note?.pin : undefined}
      />
    </div>
  );
}
