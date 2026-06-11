/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import { Note } from '../types';
import { Mic, Brush, FileText, Clock, Trash2, LayoutGrid, List, MoreVertical, Heart, Lock, FolderPlus, EyeOff, FolderMinus } from 'lucide-react';
import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { useNavigate } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Menu, Transition } from '@headlessui/react';
import NoteLockModal from '../components/NoteLockModal';
import CategoryPicker from '../components/CategoryPicker';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const { isGridLayout, searchQuery, theme, accentColor } = useUI();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const notesRef = collection(db, 'notes');
    const q = query(
      notesRef, 
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData: Note[] = [];
      snapshot.forEach((doc) => {
        notesData.push({ id: doc.id, ...doc.data() } as Note);
      });
      setNotes(notesData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notes');
    });

    return () => unsubscribe();
  }, [user]);

  const stripHtml = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
  };

  const filteredNotes = notes.filter(note => {
    // Keep notes without a category on the Home page
    if (note.category) return false;
    // Keep notes that are not favorited on the Home page
    if (note.isFavourite) return false;

    const searchLower = searchQuery.toLowerCase();
    const cleanContent = stripHtml(note.content).toLowerCase();
    
    return (
      note.title.toLowerCase().includes(searchLower) || 
      cleanContent.includes(searchLower)
    );
  });

  const [longPressedNote, setLongPressedNote] = useState<Note | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [lockModal, setLockModal] = useState<{ 
    isOpen: boolean; 
    mode: 'lock' | 'unlock'; 
    note: Note | null;
    action: 'unlock_permanent' | 'access'
  }>({ isOpen: false, mode: 'lock', note: null, action: 'access' });
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

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
        // Validation is now handled inside NoteLockModal with expectedPin
        if (lockModal.action === 'unlock_permanent') {
          await updateDoc(doc(db, 'notes', lockModal.note.id), {
            isLocked: false,
            updatedAt: Date.now()
          });
        } else if (lockModal.action === 'access') {
          // Temporarily just navigate to editor
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
    }, 200); // 200ms for long press - faster!
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleCardClick = (note: Note) => {
    if (longPressedNote) return;

    // Always navigate, let the editor handle its own lock screen if needed
    // This avoids double-PIN entry (one in Home/Categories and one in Editor)
    navigate(note.type === 'drawing' ? `/canvas/${note.id}` : `/note/${note.id}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div 
          className="w-12 h-12 border-4 border-slate-100 dark:border-slate-800 rounded-full animate-spin"
          style={{ borderTopColor: accentColor }}
        />
        <p className="text-slate-400 dark:text-slate-600 font-medium italic">Gathering your notes...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Quick Actions for Mobile/Home */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <button 
          onClick={() => navigate('/note/new?type=voice')}
          className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-indigo-900/5 group active:scale-95 transition-all"
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
            <Mic size={24} strokeWidth={2.5} />
          </div>
          <span className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Voice Note</span>
        </button>

        <button 
          onClick={() => navigate('/canvas/new')}
          className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-indigo-900/5 group active:scale-95 transition-all"
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
            <Brush size={24} strokeWidth={2.5} />
          </div>
          <span className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Sketch</span>
        </button>
      </div>

      {filteredNotes.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-md rounded-[3rem] p-16 text-center shadow-2xl shadow-indigo-900/5 dark:shadow-black/20 border border-slate-100 dark:border-slate-800"
        >
          <div 
            className="w-24 h-24 rounded-[3rem] mx-auto mb-8 flex items-center justify-center shadow-inner"
            style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
          >
            <FileText size={48} strokeWidth={2.5} />
          </div>
          <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {searchQuery ? "No matches found" : "Inbox is Clear"}
          </h3>
          <p className="text-slate-400 dark:text-slate-500 mt-4 max-w-xs mx-auto font-medium text-lg leading-relaxed">
            {searchQuery 
              ? `No notes match "${searchQuery}". Try searching for something else.` 
              : "All your thoughts are organized. Move notes here from folders if you need them in the main view."}
          </p>
        </motion.div>
      ) : (
        <div className={cn(
          "grid gap-4 sm:gap-8 pb-32",
          isGridLayout ? "grid-cols-2" : "grid-cols-1"
        )}>
          {filteredNotes.map((note, index) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, type: "spring", stiffness: 100 }}
              onPointerDown={() => startLongPress(note)}
              onPointerUp={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onClick={() => handleCardClick(note)}
              className={cn(
                "group relative border shadow-xl hover:shadow-2xl transition-all cursor-pointer overflow-hidden flex flex-col hover:-translate-y-1 active:scale-95",
                isGridLayout ? "p-5 sm:p-10 rounded-[2rem] sm:rounded-[3rem] h-48 sm:h-64" : "p-8 rounded-[2.2rem] h-auto min-h-[160px]",
                "border-black/5 hover:shadow-indigo-900/10"
              )}
              style={{ 
                backgroundColor: note.color || '#F1F5F9' 
              }}
            >
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center gap-2 mb-1 sm:mb-2">
                  <h3 className={cn(
                    "font-black line-clamp-1 pr-10 sm:pr-12 text-slate-900",
                    isGridLayout ? "text-base sm:text-2xl" : "text-xl",
                  )}>{note.title || "Untitled"}</h3>
                  {note.isFavourite && <Heart size={14} className="fill-rose-500 text-rose-500 shrink-0" />}
                  {note.isLocked && <Lock size={14} className="text-indigo-600 shrink-0" />}
                </div>

                {note.category && (
                  <div className="mb-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-white/40 text-slate-900/60 uppercase tracking-wider">
                      {note.category}
                    </span>
                  </div>
                )}

                <div className={cn(
                  "leading-relaxed font-bold text-slate-900/60",
                  isGridLayout ? "text-[10px] sm:text-sm line-clamp-3 sm:line-clamp-4" : "text-base line-clamp-2",
                  note.isLocked && "blur-md select-none"
                )}>
                  {note.isLocked ? (
                    <div className="flex flex-col items-center justify-center p-4 rounded-2xl gap-2 mt-2">
                      <EyeOff size={24} className="text-slate-400" />
                      <p className="text-xs italic uppercase tracking-widest text-slate-400">Content Locked</p>
                    </div>
                  ) : (
                    note.type === 'drawing' ? (
                      <div className="mt-2 rounded-xl overflow-hidden border border-black/5 bg-white/50 h-24 sm:h-32">
                        <img src={note.content} alt="Drawing Preview" className="w-full h-full object-cover opacity-80" />
                      </div>
                    ) : (
                      stripHtml(note.content)
                    )
                  )}
                </div>
              </div>

              <div className={cn(
                "flex items-center justify-between",
                isGridLayout ? "mt-auto" : "mt-6"
              )}>
                <div className={cn(
                  "flex items-center gap-1 sm:gap-2 text-[8px] sm:text-xs font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] text-slate-900/40",
                )}>
                  <Clock size={12} className="sm:w-4 sm:h-4" strokeWidth={3} />
                  <span>{new Date(note.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                </div>
                
                <div className="p-1.5 sm:p-3 bg-white/40 backdrop-blur-sm shadow-sm rounded-lg sm:rounded-2xl text-slate-900/40">
                   {note.type === 'voice' ? <Mic size={14} className="sm:w-5 sm:h-5" strokeWidth={2.5} /> : 
                    note.type === 'drawing' ? <Brush size={14} className="sm:w-5 sm:h-5" strokeWidth={2.5} /> : 
                    <FileText size={14} className="sm:w-5 sm:h-5" strokeWidth={2.5} />}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modern High-End Popup Menu for Long Press */}
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
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[3rem] overflow-hidden shadow-2xl border border-white/20 dark:border-slate-800"
            >
              <div className="p-8 pb-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Note Actions</h4>
                <p className="text-xl font-black text-slate-900 dark:text-white line-clamp-1">
                  {longPressedNote.title || "Untitled"}
                </p>
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
                        className="w-full flex items-center gap-4 p-5 rounded-[1.8rem] bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group"
                      >
                        <div className={cn(
                          "p-3 rounded-2xl shadow-sm transition-all group-active:scale-90",
                          longPressedNote.isFavourite ? "bg-rose-50 text-rose-500" : "bg-white text-slate-400"
                        )}>
                          <Heart size={20} className={cn(longPressedNote.isFavourite && "fill-rose-500")} strokeWidth={2.5} />
                        </div>
                        <span className="font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-xs">
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
                        className="w-full flex items-center gap-4 p-5 rounded-[1.8rem] bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group"
                      >
                        <div className={cn(
                          "p-3 rounded-2xl shadow-sm transition-all group-active:scale-90",
                          longPressedNote.isLocked ? "bg-indigo-50 text-indigo-500" : "bg-white text-slate-400"
                        )}
                        style={{ backgroundColor: longPressedNote.isLocked ? `${accentColor}15` : undefined, color: longPressedNote.isLocked ? accentColor : undefined }}
                        >
                          <Lock size={20} strokeWidth={2.5} />
                        </div>
                        <span className="font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-xs">
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

              <button 
                onClick={() => setLongPressedNote(null)}
                className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest text-[9px] hover:text-slate-600 transition-colors"
              >
                Tap anywhere to close
              </button>
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
