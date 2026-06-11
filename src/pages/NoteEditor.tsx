/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  Save, 
  Trash2, 
  Bold as BoldIcon, 
  Italic as ItalicIcon, 
  Underline as UnderlineIcon, 
  Palette, 
  Type,
  Baseline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Heading1,
  Heading2,
  Minus,
  Lock,
  Eye,
  FolderPlus,
  FolderMinus,
  MoreVertical,
  X,
} from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import NoteLockModal from '../components/NoteLockModal';
import CategoryPicker from '../components/CategoryPicker';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Placeholder from '@tiptap/extension-placeholder';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Mic, MicOff, Volume2 } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PAGE_COLORS = [
  '#FFFFFF', '#FFEDD5', '#E0F2FE', '#F0FDF4', '#FEF2F2', '#F5F3FF', '#FFFBEB', '#F1F5F9'
];

const TEXT_COLORS = [
  '#000000', '#4B5563', '#2563EB', '#059669', '#DC2626', '#7C3AED', '#D97706'
];

const FONTS = [
  { name: 'Default', value: 'font-sans' },
  { name: 'Elegant', value: 'font-playfair' },
  { name: 'Modern', value: 'font-montserrat' },
  { name: 'Classic', value: 'font-lora' },
  { name: 'Clean', value: 'font-poppins' },
  { name: 'Handwritten', value: 'font-dancing' },
  { name: 'Sweet', value: 'font-pacifico' },
  { name: 'Bold', value: 'font-oswald' },
  { name: 'Robust', value: 'font-roboto-slab' },
  { name: 'Rounded', value: 'font-quicksand' },
  { name: 'Sketchy', value: 'font-shadows' },
  { name: 'Casual', value: 'font-caveat' },
  { name: 'Regal', value: 'font-cinzel' },
  { name: 'Impact', value: 'font-bebas' },
  { name: 'Vibrant', value: 'font-marker' },
  { name: 'Organic', value: 'font-kalam' },
  { name: 'Playful', value: 'font-indie' },
  { name: 'Friendly', value: 'font-fredoka' },
  { name: 'Tech', value: 'font-space' },
  { name: 'Code', value: 'font-mono' },
];

export default function NoteEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isVoiceMode = searchParams.get('type') === 'voice';
  
  const noteIdRef = useRef<string | null>(id && id !== 'new' ? id : null);
  const { user } = useAuth();
  const { theme, accentColor, baseFontSize, autoSaveEnabled } = useUI();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState(PAGE_COLORS[0]);
  const [fontFamily, setFontFamily] = useState(FONTS[0].value);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedContent, setLastSavedContent] = useState('');
  const [lastSavedTitle, setLastSavedTitle] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [lockedNoteData, setLockedNoteData] = useState<any>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showPageColorPicker, setShowPageColorPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [dragConstraints, setDragConstraints] = useState({ left: 0, right: 0 });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Placeholder.configure({
        placeholder: 'Start writing your note...',
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose max-w-none focus:outline-none min-h-[500px]',
      },
    },
  });

  // Voice State
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState<'hi-IN' | 'en-US'>('hi-IN');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('speechRecognition' in window)) {
      setSpeechError("Speech recognition is not supported in this browser. Please use Chrome or Safari.");
      return;
    }

    setSpeechError(null);
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).speechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechLang;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        editor?.commands.insertContent(finalTranscript + ' ');
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setSpeechError("Microphone Access Denied! Please enable permissions in your address bar.");
      } else if (event.error === 'no-speech') {
        // Safe ignore
      } else {
        setSpeechError(`Voice Error: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err: any) {
      console.error("Failed to start voice recognition:", err);
    }
  }, [editor, speechLang]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error("Error stopping recognition:", err);
      }
      setIsListening(false);
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    // If voice mode is on, we don't start automatically anymore (to avoid browser prompt blocking), 
    // but we can offer helpful feedback to begin speaks!
    if (isVoiceMode && editor && !loading && !isLocked) {
      setSpeechError(null);
    }
  }, [isVoiceMode, editor, loading, isLocked]);

  useEffect(() => {
    if (id && id !== 'new') {
      noteIdRef.current = id;
    } else {
      noteIdRef.current = null;
    }
  }, [id]);

  useEffect(() => {
    const updateConstraints = () => {
      if (toolbarRef.current) {
        const containerWidth = toolbarRef.current.parentElement?.offsetWidth || 0;
        const contentWidth = toolbarRef.current.scrollWidth;
        const diff = containerWidth - contentWidth;
        setDragConstraints({ left: diff < 0 ? diff : 0, right: 0 });
      }
    };

    updateConstraints();
    window.addEventListener('resize', updateConstraints);
    return () => window.removeEventListener('resize', updateConstraints);
  }, []);

  useEffect(() => {
    if (id && id !== 'new') {
      loadNote();
    }
  }, [id, editor]);

  const loadNote = async () => {
    if (!id || !editor) return;
    setLoading(true);
    try {
      const docRef = doc(db, 'notes', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsLocked(!!data.isLocked);
        if (data.isLocked) {
          setLockedNoteData(data);
          setLoading(false);
          return;
        }
        setTitle(data.title);
        setCategory(data.category || null);
        setLastSavedTitle(data.title);
        editor.commands.setContent(data.content || '');
        setLastSavedContent(data.content || '');
        setSelectedColor(data.color || PAGE_COLORS[0]);
        if (data.fontFamily) setFontFamily(data.fontFamily);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `notes/${id}`);
    } finally {
      setLoading(false);
    }
  };

  const [lockModal, setLockModal] = useState<{ isOpen: boolean; mode: 'lock' | 'unlock' }>({ isOpen: false, mode: 'lock' });

  const handleVerify = () => {
    setLockModal({ isOpen: true, mode: 'unlock' });
  };

  const handleLockConfirm = async (pin: string) => {
    if (lockModal.mode === 'unlock') {
      // Use pre-loaded data if available, or fetch if not
      let data = lockedNoteData;
      
      if (!data) {
        try {
          const docRef = doc(db, 'notes', id!);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            data = docSnap.data();
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `notes/${id}`);
          return;
        }
      }

      if (data && pin === data.pin) {
        setLockedNoteData(data);
        setCategory(data.category || null);
        setIsVerified(true);
        setIsLocked(false);
        setLockModal({ isOpen: false, mode: 'lock' });
      }
    } else {
      // Logic for locking the current note
      if (!id || id === 'new') {
        alert("Please save the note first before locking it.");
        return;
      }
      try {
        await updateDoc(doc(db, 'notes', id), {
          isLocked: true,
          pin: pin,
          updatedAt: Date.now()
        });
        setIsLocked(true);
        setIsVerified(false);
        setLockModal({ isOpen: false, mode: 'lock' });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `notes/${id}`);
      }
    }
  };

  // Effect to load content AFTER verification and rendering
  useEffect(() => {
    if (isVerified && lockedNoteData && editor) {
      setLoading(true);
      const data = lockedNoteData;
      setTitle(data.title || '');
      setCategory(data.category || null);
      setLastSavedTitle(data.title || '');
      editor.commands.setContent(data.content || '');
      setLastSavedContent(data.content || '');
      setSelectedColor(data.color || PAGE_COLORS[0]);
      if (data.fontFamily) setFontFamily(data.fontFamily);
      setLoading(false);
    }
  }, [isVerified, lockedNoteData, editor]);

  const toggleNoteLock = () => {
    if (isLocked || lockedNoteData?.isLocked) {
      // To unlock permanently, we need to verify first if not already verified
      if (!isVerified) {
        setLockModal({ isOpen: true, mode: 'unlock' });
      } else {
        // Already verified, so we can unlock permanently
        if (window.confirm("Unlock this note permanently?")) {
          const unlockPermanently = async () => {
            try {
              await updateDoc(doc(db, 'notes', id!), {
                isLocked: false,
                updatedAt: Date.now()
              });
              setIsLocked(false);
              setLockedNoteData(prev => ({ ...prev, isLocked: false }));
            } catch (error) {
              handleFirestoreError(error, OperationType.UPDATE, `notes/${id}`);
            }
          };
          unlockPermanently();
        }
      }
    } else {
      // Set a new lock
      setLockModal({ isOpen: true, mode: 'lock' });
    }
  };

  const saveNote = async (isAuto = false) => {
    if (!user || !editor || isLocked) return null;
    const content = editor.getHTML();
    if (!title.trim() && editor.isEmpty) return null;
    
    // Prevent redundant saves
    if (isAuto && content === lastSavedContent && title === lastSavedTitle) return null;

    setSaving(true);
    setSaveStatus('saving');
    const now = Date.now();
    
    // Use existing ID from ref or generate a new one ONCE
    const isNew = !noteIdRef.current;
    if (isNew) {
      noteIdRef.current = doc(collection(db, 'notes')).id;
    }
    const noteId = noteIdRef.current!;

    const noteData = {
      title: title || 'Untitled Note',
      content: content,
      category: category,
      color: selectedColor,
      fontFamily: fontFamily,
      userId: user.uid,
      updatedAt: now,
      type: 'text' as const,
      isLocked: isLocked // Persist current lock state
    };

    try {
      const docRef = doc(db, 'notes', noteId);
      if (isNew) {
        await setDoc(docRef, { ...noteData, createdAt: now });
      } else {
        await updateDoc(docRef, { ...noteData });
      }
      setLastSavedContent(content);
      setLastSavedTitle(title);
      setSaveStatus('saved');
      
      // Update the URL if it's a new note
      if (id === 'new') {
        window.history.replaceState(null, '', `/note/${noteId}`);
      }
      return noteId;
    } catch (error) {
      setSaveStatus('error');
      handleFirestoreError(error, OperationType.WRITE, `notes/${noteId}`);
      return null;
    } finally {
      setSaving(false);
      if (saveStatus !== 'error') {
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    }
  };

  const handleManualSave = async () => {
    const savedId = await saveNote();
    if (savedId) navigate('/');
  };

  // Auto-save logic
  useEffect(() => {
    if (!autoSaveEnabled || !editor || isLocked) return;

    const triggerAutoSave = () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      
      setSaveStatus('saving');
      autoSaveTimerRef.current = setTimeout(() => {
        saveNote(true);
      }, 2000); // Save after 2 seconds of inactivity
    };

    const onUpdate = () => {
      triggerAutoSave();
    };

    editor.on('update', onUpdate);
    
    // Also trigger on title, color, or font change
    triggerAutoSave();

    return () => {
      editor.off('update', onUpdate);
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [editor, title, autoSaveEnabled, selectedColor, fontFamily, isLocked]);

  // Prevent accidental exit while saving
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saving || saveStatus === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saving, saveStatus]);

  const handleSetCategory = async (newCat: string | null) => {
    setCategory(newCat);
    
    // If it's an existing note, update it immediately in DB too
    if (id && id !== 'new') {
      try {
        await updateDoc(doc(db, 'notes', id), {
          category: newCat,
          updatedAt: Date.now()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `notes/${id}`);
      }
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'notes', id));
      navigate('/');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notes/${id}`);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: selectedColor }}>
        <div className="w-10 h-10 border-4 border-black/5 border-t-black rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {isLocked && !isVerified ? (
          <motion.div 
            key="lock-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-6 text-center"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-md w-full"
            >
              <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl border border-white/10">
                <Lock size={48} className="text-rose-400" strokeWidth={2.5} />
              </div>
              <h2 className="text-3xl font-black text-white tracking-tight mb-4 uppercase">Private Note</h2>
              <p className="text-slate-400 font-medium mb-12 leading-relaxed italic">
                This note is protected by PIN Shield. Please verify your identity to view the content.
              </p>

              <button 
                onClick={handleVerify}
                className="w-full py-6 bg-rose-600 hover:bg-rose-500 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4 border border-rose-400/30"
              >
                <Lock size={24} />
                <span>Enter PIN</span>
              </button>

              <button 
                onClick={() => navigate('/')}
                className="mt-8 text-slate-500 font-black uppercase tracking-widest text-[10px] hover:text-white transition-colors"
              >
                Go Back to Safety
              </button>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div 
            key="editor-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-50 flex flex-col transition-colors duration-500 ease-in-out overflow-hidden"
            style={{ backgroundColor: selectedColor }}
          >
            {/* Header */}
            <header className="h-20 px-6 flex items-center justify-between border-b border-black/5 bg-white/40 backdrop-blur-md shrink-0 z-50">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => navigate('/')}
                  className="p-3 hover:bg-black/5 rounded-2xl transition-all active:scale-90"
                  style={{ color: accentColor }}
                >
                  <ChevronLeft size={24} />
                </button>
                
                {autoSaveEnabled && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-black/5 rounded-full border border-black/5">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      saveStatus === 'saving' ? "bg-amber-500 animate-pulse" : 
                      saveStatus === 'saved' ? "bg-emerald-500" : 
                      saveStatus === 'error' ? "bg-rose-500" : "bg-slate-300"
                    )} />
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                      {saveStatus === 'saving' ? 'Syncing' : 
                       saveStatus === 'saved' ? 'Saved' : 
                       saveStatus === 'error' ? 'Error' : 'Cloud Active'}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  disabled={saving}
                  onClick={handleManualSave}
                  className="flex items-center gap-3 text-white px-8 py-3.5 rounded-[1.8rem] font-black uppercase tracking-widest text-[10px] transition-all disabled:opacity-50 shadow-xl active:scale-95"
                  style={{ backgroundColor: accentColor, boxShadow: `0 10px 15px -3px ${accentColor}40` }}
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : <Save size={18} strokeWidth={3.1} />}
                  <span>Save</span>
                </button>
              </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto w-full">
              <div className="max-w-3xl mx-auto px-6 py-8">
                <input 
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title"
                  className={cn(
                    "w-full text-3xl font-bold bg-transparent border-none focus:outline-none placeholder:text-slate-400 mb-8 transition-colors",
                    "text-slate-900",
                    fontFamily
                  )}
                />
                
                <div 
                  className={cn("editor-wrapper", fontFamily)}
                  style={{ fontSize: `${baseFontSize}px` }}
                >
                  <div className="prose-base-content">
                    <EditorContent editor={editor} />
                  </div>
                </div>
              </div>
            </main>

            {/* Bottom Toolbar */}
            <footer className="shrink-0 bg-white shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] border-t border-slate-200 transition-colors">
              {/* Sub-toolbars (Popups) */}
              <div className="max-w-4xl mx-auto relative px-4 text-slate-900">
                <AnimatePresence>
                  {showColorPicker && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full mb-4 bg-white shadow-2xl p-3 rounded-2xl flex gap-2 border border-slate-200 left-1/2 -translate-x-1/2 z-10"
                    >
                      {TEXT_COLORS.map(color => (
                        <button
                          key={color}
                          onClick={() => {
                            editor?.chain().focus().setColor(color).run();
                            setShowColorPicker(false);
                          }}
                          className="w-8 h-8 rounded-full border border-black/5 hover:scale-110 transition-transform"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </motion.div>
                  )}

                  {showPageColorPicker && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full mb-4 bg-white shadow-2xl p-3 rounded-2xl flex gap-2 border border-slate-200 left-1/2 -translate-x-1/2 z-10"
                    >
                      {PAGE_COLORS.map(color => (
                        <button
                          key={color}
                          onClick={() => {
                            setSelectedColor(color);
                            setShowPageColorPicker(false);
                          }}
                          className="w-8 h-8 rounded-full border border-black/5 hover:scale-110 transition-transform"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </motion.div>
                  )}

                  {showFontPicker && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full mb-4 bg-white shadow-2xl p-2 rounded-2xl flex flex-col gap-1 border border-slate-200 min-w-[160px] max-h-[300px] overflow-y-auto left-1/2 -translate-x-1/2 z-10 no-scrollbar shadow-indigo-100/50"
                    >
                      {FONTS.map(font => (
                        <button
                          key={font.value}
                          onClick={() => {
                            setFontFamily(font.value);
                            setShowFontPicker(false);
                          }}
                          className={cn(
                            "px-4 py-2 text-left rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium",
                            font.value,
                            fontFamily === font.value ? "bg-slate-100 text-slate-900" : "text-slate-600"
                          )}
                        >
                          {font.name}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Toolbar Grid */}
              <div className="p-3 overflow-hidden select-none">
                <motion.div 
                  ref={toolbarRef}
                  drag="x"
                  dragConstraints={dragConstraints}
                  dragElastic={0.1}
                  className="flex items-center gap-4 sm:gap-12 min-w-max px-8 cursor-grab active:cursor-grabbing"
                >
                  <div className="flex items-center gap-1 bg-slate-50 rounded-xl p-1.5 border border-slate-200 shadow-sm">
                    <button 
                      onClick={toggleListening}
                      className={cn(
                        "p-2.5 rounded-lg transition-all active:scale-90 relative",
                        isListening ? "text-white animate-pulse" : "hover:bg-slate-200 text-slate-600"
                      )}
                      style={{ backgroundColor: isListening ? '#EF4444' : undefined }}
                      title={isListening ? "Stop Listening" : "Speak to Write"}
                    >
                      {isListening ? <Mic size={20} /> : <Mic size={20} />}
                      {isListening && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                        </span>
                      )}
                    </button>
                    <div className="w-px h-6 bg-slate-200 mx-1" />
                    <button 
                      onClick={() => editor?.chain().focus().toggleBold().run()}
                      className={cn(
                        "p-2.5 rounded-lg transition-all active:scale-90",
                        editor?.isActive('bold') ? "text-white" : "hover:bg-slate-200 text-slate-600"
                      )}
                      style={{ backgroundColor: editor?.isActive('bold') ? accentColor : undefined }}
                      title="Bold (Ctrl+B)"
                    >
                      <BoldIcon size={20} />
                    </button>
                    <button 
                      onClick={() => editor?.chain().focus().toggleItalic().run()}
                      className={cn(
                        "p-2.5 rounded-lg transition-all active:scale-90",
                        editor?.isActive('italic') ? "text-white" : "hover:bg-slate-200 text-slate-600"
                      )}
                      style={{ backgroundColor: editor?.isActive('italic') ? accentColor : undefined }}
                      title="Italic (Ctrl+I)"
                    >
                      <ItalicIcon size={20} />
                    </button>
                    <button 
                      onClick={() => editor?.chain().focus().toggleUnderline().run()}
                      className={cn(
                        "p-2.5 rounded-lg transition-all active:scale-90",
                        editor?.isActive('underline') ? "text-white" : "hover:bg-slate-200 text-slate-600"
                      )}
                      style={{ backgroundColor: editor?.isActive('underline') ? accentColor : undefined }}
                      title="Underline (Ctrl+U)"
                    >
                      <UnderlineIcon size={20} />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowColorPicker(!showColorPicker);
                        setShowPageColorPicker(false);
                        setShowFontPicker(false);
                      }}
                      className={cn(
                        "p-3 rounded-2xl transition-all flex items-center justify-center gap-3 border-2 shadow-sm",
                        showColorPicker ? "shadow-xl" : ""
                      )}
                      style={{ 
                        backgroundColor: 'white',
                        borderColor: showColorPicker ? accentColor : '#f1f5f9'
                      }}
                      title="Text Color"
                    >
                      <Type size={20} className="text-slate-600" />
                      <div className="w-5 h-5 rounded-full border border-black/10 shadow-inner" style={{ backgroundColor: editor?.getAttributes('textStyle').color || '#000000' }} />
                    </button>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPageColorPicker(!showPageColorPicker);
                        setShowColorPicker(false);
                        setShowFontPicker(false);
                      }}
                      className={cn(
                        "p-3 rounded-2xl transition-all flex items-center justify-center gap-3 border-2 shadow-sm",
                        showPageColorPicker ? "shadow-xl" : ""
                      )}
                      style={{ 
                        backgroundColor: 'white',
                        borderColor: showPageColorPicker ? accentColor : '#f1f5f9'
                      }}
                      title="Page Color"
                    >
                      <Palette size={20} className="text-slate-600" />
                      <div className="w-5 h-5 rounded-full border border-black/10 shadow-inner" style={{ backgroundColor: selectedColor }} />
                    </button>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowFontPicker(!showFontPicker);
                        setShowColorPicker(false);
                        setShowPageColorPicker(false);
                      }}
                      className={cn(
                        "p-3 rounded-2xl transition-all flex items-center justify-center gap-4 border-2 shadow-sm min-w-[160px]",
                        showFontPicker ? "shadow-xl" : ""
                      )}
                      style={{ 
                        backgroundColor: 'white',
                        borderColor: showFontPicker ? accentColor : '#f1f5f9'
                      }}
                      title="Font Family"
                    >
                      <Baseline size={20} className="text-slate-600 shrink-0" />
                      <span className="text-sm font-black uppercase truncate tracking-wider">
                        {FONTS.find(f => f.value === fontFamily)?.name}
                      </span>
                    </button>
                  </div>
                </motion.div>
              </div>

              {/* Immersive Voice Assistant Panel */}
              {isVoiceMode && (
                <div className="max-w-2xl mx-auto w-full px-6 py-4">
                  <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {/* Pulsing Visual Indicator */}
                      <button
                        onClick={toggleListening}
                        className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 transform active:scale-95 shadow-lg shrink-0",
                          isListening ? "bg-red-500 hover:bg-red-600 animate-pulse" : "bg-indigo-600 hover:bg-indigo-700"
                        )}
                        title={isListening ? "Stop Microphone" : "Tap to Speak Hindi/English"}
                      >
                        {isListening ? (
                          <div className="relative flex items-center justify-center">
                            <MicOff size={22} className="text-white" />
                            <span className="absolute -top-1 -right-1 flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                            </span>
                          </div>
                        ) : (
                          <Mic size={22} className="text-white" />
                        )}
                      </button>

                      <div className="space-y-1 text-center sm:text-left">
                        <div className="flex items-center gap-2 justify-center sm:justify-start">
                          <span className={cn(
                            "w-2 h-2 rounded-full inline-block",
                            isListening ? "bg-red-500 animate-ping" : "bg-slate-500"
                          )} />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {isListening ? "Microphone Live" : "Microphone Idle"}
                          </span>
                        </div>
                        {speechError ? (
                          <span className="text-rose-400 text-xs font-bold block">{speechError}</span>
                        ) : (
                          <span className="text-slate-300 text-xs font-medium block">
                            {isListening ? "Speaking Hindi or English writes text instantly!" : "Tap the mic icon or start speaking to dictate notes."}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Language Switcher Capsule */}
                    <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 shrink-0">
                      <button
                        onClick={() => {
                          if (isListening) stopListening();
                          setSpeechLang('hi-IN');
                        }}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                          speechLang === 'hi-IN' ? "bg-indigo-600 text-white shadow-xl" : "text-slate-400 hover:text-white"
                        )}
                      >
                        हिंदी (Hinglish)
                      </button>
                      <button
                        onClick={() => {
                          if (isListening) stopListening();
                          setSpeechLang('en-US');
                        }}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                          speechLang === 'en-US' ? "bg-indigo-600 text-white shadow-xl" : "text-slate-400 hover:text-white"
                        )}
                      >
                        English
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </footer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lock Modal */}
      <NoteLockModal
        isOpen={lockModal.isOpen}
        mode={lockModal.mode}
        onClose={() => setLockModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleLockConfirm}
        title={title || lockedNoteData?.title}
        expectedPin={lockedNoteData?.pin}
      />

      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/10 backdrop-blur-[2px]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[3rem] p-8 shadow-2xl border border-slate-100 dark:border-slate-800 text-center space-y-6"
            >
              <div className="w-20 h-20 bg-rose-50 dark:bg-rose-950/30 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner">
                <Trash2 size={32} className="text-rose-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Delete Permanently?</h3>
                <p className="text-sm text-slate-500 font-medium italic">This note will be gone forever. This action cannot be undone.</p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleDelete}
                  className="w-full py-5 bg-rose-600 text-white rounded-[1.8rem] font-black uppercase tracking-[0.2em] shadow-xl shadow-rose-500/30 active:scale-95 transition-all"
                >
                  Confirm Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full py-4 text-slate-400 font-black uppercase tracking-widest text-[10px] hover:text-slate-600 transition-colors"
                >
                  Keep My Note
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
