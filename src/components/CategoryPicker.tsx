
import { motion, AnimatePresence } from 'motion/react';
import { FolderPlus, FolderMinus, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CategoryPickerProps {
  currentCategory: string | null;
  onSelect: (category: string | null) => void;
  accentColor: string;
}

export default function CategoryPicker({ currentCategory, onSelect, accentColor }: CategoryPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const notesRef = collection(db, 'notes');
    const q = query(notesRef, where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats = new Set<string>();
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.category) cats.add(data.category);
      });
      setExistingCategories(Array.from(cats).sort());
    });
    return () => unsubscribe();
  }, [user]);

  const handleSave = () => {
    if (newFolderName.trim()) {
      onSelect(newFolderName.trim());
      setNewFolderName('');
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={cn(
          "p-2.5 rounded-2xl transition-all shadow-sm border active:scale-95",
          currentCategory 
            ? "bg-amber-50 text-amber-600 border-amber-200" 
            : "bg-white dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800"
        )}
        title={currentCategory ? `Folder: ${currentCategory}` : "Add to folder"}
      >
        {currentCategory ? <FolderMinus size={20} /> : <FolderPlus size={20} />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[140] bg-black/20 backdrop-blur-[4px]" 
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }} 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] max-w-sm bg-white dark:bg-slate-900 rounded-[3.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-slate-800 z-[150] overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Add to Category</span>
                  {currentCategory && (
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                       <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{currentCategory}</span>
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <X size={18} className="text-slate-400" />
                </button>
              </div>
              
              <div className="p-8 space-y-6 bg-white dark:bg-slate-900">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Folder Name</label>
                    <input 
                      type="text"
                      autoFocus
                      placeholder="Enter name..."
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                      className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-[1.8rem] text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-300"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    {currentCategory && (
                      <button
                        onClick={() => {
                          onSelect(null);
                          setIsOpen(false);
                        }}
                        className="flex-1 py-5 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 border border-rose-100 dark:border-rose-900/50"
                      >
                        Remove
                      </button>
                    )}
                    <button
                      onClick={handleSave}
                      disabled={!newFolderName.trim()}
                      className={cn(
                        "flex-[2] py-5 rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2",
                        newFolderName.trim() 
                          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-slate-200 dark:shadow-none" 
                          : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-50"
                      )}
                    >
                      <FolderPlus size={16} />
                      <span>Save Folder</span>
                    </button>
                  </div>
                </div>

                {existingCategories.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-slate-50 dark:border-slate-800">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 px-2">Existing Folders</span>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 no-scrollbar">
                      {existingCategories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => {
                            onSelect(cat);
                            setIsOpen(false);
                          }}
                          className={cn(
                            "px-4 py-3 rounded-2xl text-[11px] font-black transition-all border",
                            currentCategory === cat 
                              ? "bg-indigo-50 border-indigo-200 text-indigo-600" 
                              : "bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
