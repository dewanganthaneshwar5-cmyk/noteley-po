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
import { ChevronLeft, FolderPlus, Trash2, Lock, EyeOff, Heart, Folder, FolderMinus } from 'lucide-react';
import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { useNavigate } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import NoteLockModal from '../components/NoteLockModal';
import CategoryPicker from '../components/CategoryPicker';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Categories() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { accentColor } = useUI();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [longPressedNote, setLongPressedNote] = useState<Note | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
        .filter((note: any) => !!note.category) as Note[];
        
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

  const handleSetCategory = async (id: string, newCategory: string | null) => {
    try {
      await updateDoc(doc(db, 'notes', id), {
        category: newCategory,
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
    }, 200);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Group notes by category
  const categories = notes.reduce((acc, note) => {
    const cat = note.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(note);
    return acc;
  }, {} as Record<string, Note[]>);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div 
          className="w-12 h-12 border-4 border-slate-100 dark:border-slate-800 rounded-full animate-spin"
          style={{ borderTopColor: accentColor }}
        />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading Categories...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 pb-32">
      <header className="flex items-center gap-6 mb-12">
        <button 
          onClick={() => navigate('/')}
          className="p-4 bg-white hover:bg-slate-50 dark:bg-slate-900 rounded-3xl transition-all shadow-lg active:scale-90 border border-slate-100 dark:border-slate-800"
          style={{ color: accentColor }}
        >
          <ChevronLeft size={24} strokeWidth={3} />
        </button>
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Categories</h1>
          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mt-1">
            Organized Thinking
          </p>
        </div>
      </header>

      {Object.keys(categories).length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-32 bg-slate-50 dark:bg-slate-800/20 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800"
        >
          <div className="w-20 h-20 bg-white dark:bg-slate-900 rounded-[2rem] flex items-center justify-center shadow-xl mb-6">
            <Folder size={32} className="text-slate-200" />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">No Categorized Notes</h2>
          <p className="text-slate-400 font-medium max-w-xs text-center leading-relaxed">
            Organize your notes by assigning them categories from the home screen.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-12">
          {Object.entries(categories).map(([category, catNotes]) => (
            <div key={category} className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-4 py-2 rounded-xl">
                  {category}
                </h2>
                <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {catNotes.map((note) => (
                  <motion.div
                    key={note.id}
                    onPointerDown={() => startLongPress(note)}
                    onPointerUp={cancelLongPress}
                    onPointerLeave={cancelLongPress}
                    onClick={() => {
                      if (!longPressedNote) {
                        // Always navigate, let the editor handle its own lock screen if needed
                        navigate(note.type === 'drawing' ? `/canvas/${note.id}` : `/note/${note.id}`);
                      }
                    }}
                    className="group relative p-8 rounded-[2.5rem] border border-black/5 shadow-xl hover:shadow-2xl transition-all cursor-pointer overflow-hidden flex flex-col hover:-translate-y-1 active:scale-95"
                    style={{ backgroundColor: note.color || '#F1F5F9' }}
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-black text-xl text-slate-900 line-clamp-1">{note.title || "Untitled"}</h3>
                        {note.isFavourite && <Heart size={16} className="fill-rose-500 text-rose-500" />}
                      </div>
                      
                      <div className={cn(
                        "leading-relaxed font-bold text-slate-900/60 text-sm line-clamp-4",
                        note.isLocked && "blur-md select-none"
                      )}>
                        {note.isLocked ? (
                          <div className="flex flex-col items-center justify-center p-4 rounded-2xl gap-2">
                            <EyeOff size={24} className="text-slate-400" />
                            <p className="text-[10px] italic uppercase tracking-widest text-slate-400 text-center">Locked Content</p>
                          </div>
                        ) : (
                          note.type === 'drawing' ? (
                            <div className="rounded-xl overflow-hidden border border-black/5 bg-white/50 h-32">
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
            </div>
          ))}
        </div>
      )}

      {/* Pop-up Menu */}
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
                <AnimatePresence mode="wait">
                  {showDeleteConfirm ? (
                    <motion.div
                      key="confirm"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="p-6 bg-rose-50 dark:bg-rose-950/20 rounded-[2.5rem] border border-rose-100 dark:border-rose-900/50 text-center space-y-5"
                    >
                      <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                        <Trash2 size={24} className="text-rose-500" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-black text-rose-600 dark:text-rose-400 uppercase tracking-[0.2em]">Permanently Delete?</p>
                        <p className="text-[10px] text-slate-500 font-bold">This cannot be undone.</p>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteConfirm(false);
                          }}
                          className="flex-1 py-4 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-100 dark:border-slate-700 shadow-sm transition-all active:scale-95"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(longPressedNote.id);
                            setShowDeleteConfirm(false);
                            setLongPressedNote(null);
                          }}
                          className="flex-1 py-4 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-rose-200 dark:shadow-none transition-all active:scale-95"
                        >
                          Confirm
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="actions"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-2"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavourite(longPressedNote.id, longPressedNote.isFavourite);
                          setLongPressedNote(null);
                        }}
                        className="w-full flex items-center gap-4 p-5 rounded-[1.8rem] bg-slate-50 hover:bg-slate-100 transition-all group"
                      >
                        <div className={cn(
                          "p-3 rounded-2xl shadow-sm bg-white transition-all group-active:scale-90",
                          longPressedNote.isFavourite ? "text-rose-500" : "text-slate-400"
                        )}>
                          <Heart size={20} className={cn(longPressedNote.isFavourite && "fill-rose-500")} strokeWidth={2.5} />
                        </div>
                        <span className="font-black text-slate-700 uppercase tracking-widest text-xs">
                          {longPressedNote.isFavourite ? "Remove from Favourites" : "Add to Favourites"}
                        </span>
                      </button>

                      <div className="w-full flex items-center gap-4 p-4 rounded-[1.8rem] bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                        <CategoryPicker 
                          currentCategory={longPressedNote.category}
                          accentColor={accentColor}
                          onSelect={(newCat) => {
                            handleSetCategory(longPressedNote.id, newCat);
                            setLongPressedNote(null);
                          }}
                        />
                        <div className="flex-1 flex flex-col">
                          <span className="font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-[10px]">
                            {longPressedNote.category ? "Move to Folder" : "Add to Folder"}
                          </span>
                          {longPressedNote.category && (
                            <span className="text-[10px] text-indigo-500 font-bold">{longPressedNote.category}</span>
                          )}
                        </div>
                        {longPressedNote.category && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetCategory(longPressedNote.id, null);
                              setLongPressedNote(null);
                            }}
                            className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-2xl border border-rose-100 dark:border-rose-900/50 active:scale-90 transition-all"
                            title="Remove from folder"
                          >
                            <FolderMinus size={18} />
                          </button>
                        )}
                      </div>

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
                            setShowDeleteConfirm(true);
                          }}
                          className="w-full flex items-center gap-4 p-5 rounded-[1.8rem] bg-rose-500 text-white hover:bg-rose-600 transition-all shadow-xl shadow-rose-500/20 group"
                        >
                          <div className="p-3 bg-white/20 rounded-2xl transition-all group-active:scale-90">
                            <Trash2 size={20} strokeWidth={2.5} />
                          </div>
                          <span className="font-black uppercase tracking-[0.2em] text-xs">Delete Permanently</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              <div className="p-4 text-center">
                <button 
                  onClick={() => setLongPressedNote(null)}
                  className="text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest text-[9px]"
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
