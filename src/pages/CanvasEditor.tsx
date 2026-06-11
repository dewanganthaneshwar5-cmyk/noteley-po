import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  Save, 
  Trash2, 
  Eraser, 
  Undo, 
  Redo, 
  Download,
  RotateCcw,
  Brush as BrushIcon,
  Pencil,
  Paintbrush,
  Palette,
  Minus,
  Settings2,
  CircleDot,
  Lock,
  FolderPlus,
  FolderMinus,
  MoreVertical,
  X,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import NoteLockModal from '../components/NoteLockModal';
import CategoryPicker from '../components/CategoryPicker';
import { doc, getDoc, setDoc, updateDoc, doc as firestoreDoc, collection, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PAGE_COLORS = [
  '#FFFFFF', '#FDFDFD', '#F9FAFB', '#F1F5F9', '#EFF6FF', '#F0FDF4', '#FFFBEB', '#FEF2F2'
];

const PRESET_COLORS = [
  // Row 1: Grayscale & Neutrals
  '#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#EEEEEE', '#F5F5F5', '#FFFFFF',
  // Row 2: Reds & Pinks
  '#FF0000', '#E53E3E', '#F56565', '#FEB2B2', '#FF007F', '#D53F8C', '#ED64A6', '#FBB6CE',
  // Row 3: Oranges & Yellows
  '#DD6B20', '#ED8936', '#F6AD55', '#FEEBC8', '#D69E2E', '#ECC94B', '#F6E05E', '#FEFCBF',
  // Row 4: Greens
  '#22543D', '#38A169', '#48BB78', '#9AE6B4', '#276749', '#2F855A', '#68D391', '#C6F6D5',
  // Row 5: Blues
  '#1A365D', '#2B6CB0', '#4299E1', '#BEE3F8', '#2A4365', '#3182CE', '#63B3ED', '#EBF8FF',
  // Row 6: Purples
  '#44337A', '#6B46C1', '#9F7AEA', '#E9D8FD', '#553C9A', '#805AD5', '#B794F4', '#FAF5FF',
];

const BRUSH_SIZES = [2, 4, 6, 8, 12, 16, 24, 32, 48, 64]; // 10 sizes

export default function CanvasEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const noteIdRef = useRef<string | null>(id && id !== 'new' ? id : null);
  const { user } = useAuth();
  const { theme, accentColor, autoSaveEnabled } = useUI();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const pointsRef = useRef<{x: number, y: number}[]>([]);
  
  const cursorRef = useRef<HTMLDivElement>(null);
  
  const isDrawingRef = useRef(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [color, setColor] = useState('#FF0000'); // Default to red ink as requested
  const [size, setSize] = useState(BRUSH_SIZES[2]); // Default size: 6px
  const [brushStyle, setBrushStyle] = useState<'round' | 'square' | 'calligraphy' | 'spray' | 'neon' | 'sketch' | 'dots' | 'ghost' | 'soft' | 'ribbon'>('round');
  const [pageColor, setPageColor] = useState('#000000'); // Default to black background canvas as requested
  
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSizePicker, setShowSizePicker] = useState(false);
  const [showPageColorPicker, setShowPageColorPicker] = useState(false);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isLocked, setIsLocked] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [lockedNoteData, setLockedNoteData] = useState<any>(null);
  const [lockModal, setLockModal] = useState<{ isOpen: boolean; mode: 'lock' | 'unlock' }>({ isOpen: false, mode: 'lock' });
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (id && id !== 'new') {
      noteIdRef.current = id;
    } else {
      noteIdRef.current = null;
    }
  }, [id]);

  // Undo/Redo State
  const [history, setHistory] = useState<string[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);

  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL();
    
    setHistory(prev => {
      const newHistory = prev.slice(0, historyStep + 1);
      newHistory.push(data);
      // Keep last 40 steps
      if (newHistory.length > 40) newHistory.shift();
      return newHistory;
    });
    setHistoryStep(prev => prev + 1);
  }, [historyStep]);

  const undo = () => {
    if (historyStep <= 0) return;
    const canvas = canvasRef.current;
    const ctx = contextRef.current || canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const step = historyStep - 1;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setHistoryStep(step);
    };
    img.src = history[step];
  };

  const redo = () => {
    if (historyStep >= history.length - 1) return;
    const canvas = canvasRef.current;
    const ctx = contextRef.current || canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const step = historyStep + 1;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setHistoryStep(step);
    };
    img.src = history[step];
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || isLocked) return;
    
    // Create temporary canvas with background
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.fillStyle = pageColor;
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.drawImage(canvas, 0, 0);
      
      const link = document.createElement('a');
      link.download = `${title || 'canvas-sketch'}.png`;
      link.href = tempCanvas.toDataURL('image/png');
      link.click();
    }
  };

  const initCanvas = useCallback((forceRestore = true) => {
    const canvas = canvasRef.current;
    if (!canvas || isLocked) return;

    const container = canvas.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const targetWidth = Math.floor(rect.width);
    const targetHeight = Math.floor(rect.height);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight || !contextRef.current) {
      let tempCanvas: HTMLCanvasElement | null = null;
      if (canvas.width > 0 && canvas.height > 0) {
        tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) tempCtx.drawImage(canvas, 0, 0);
      }
      
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      
      const context = canvas.getContext('2d', { alpha: true });
      if (!context) return;
      
      context.lineJoin = 'round';
      context.lineCap = 'round';
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      contextRef.current = context;

      if (forceRestore && tempCanvas && tempCanvas.width > 0) {
        context.drawImage(tempCanvas, 0, 0, rect.width, rect.height);
      }
    }
  }, [isLocked]);

  useEffect(() => {
    // Initial setup with a slight delay to ensure size is computed
    const timer = setTimeout(() => {
      initCanvas();
      if (id && id !== 'new') {
        loadCanvas();
      } else {
        saveToHistory();
      }
    }, 50);

    const handleResize = () => initCanvas(true);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [id, initCanvas]);

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = color;
      contextRef.current.lineWidth = size;
      contextRef.current.lineCap = brushStyle === 'square' ? 'square' : 'round';
    }
  }, [color, size, brushStyle]);

  const loadCanvas = async () => {
    if (!id) return;
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
        setTitle(data.title || '');
        setCategory(data.category || null);
        setPageColor(data.color || '#000000');
        
        if (data.content) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = canvasRef.current;
            const ctx = contextRef.current || canvas?.getContext('2d');
            if (canvas && ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              setHistory([data.content]);
              setHistoryStep(0);
            }
          };
          img.src = data.content;
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `notes/${id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = () => {
    setLockModal({ isOpen: true, mode: 'unlock' });
  };

  const handleLockConfirm = async (pin: string) => {
    if (lockModal.mode === 'unlock') {
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
        setLockedNoteData(data); // Ensure it's in state for the effect
        setCategory(data.category || null);
        setIsVerified(true);
        setIsLocked(false);
        setLockModal({ isOpen: false, mode: 'lock' });
      }
    } else {
      // Logic for locking the current note
      if (!id || id === 'new') {
        alert("Please save the drawing first before locking it.");
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

  const toggleNoteLock = () => {
    if (isLocked || lockedNoteData?.isLocked) {
      // To unlock permanently, we need to verify first if not already verified
      if (!isVerified) {
        setLockModal({ isOpen: true, mode: 'unlock' });
      } else {
        // Already verified, so we can unlock permanently
        if (window.confirm("Unlock this drawing permanently?")) {
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

  // Effect to load canvas content after verification
  useEffect(() => {
    if (isVerified && lockedNoteData?.content) {
      setLoading(true);
      setTitle(lockedNoteData.title || '');
      setCategory(lockedNoteData.category || null);
      setPageColor(lockedNoteData.color || '#000000');
      
      const img = new Image();
      img.onload = () => {
        // Wait for next tick to ensure canvas is mounted
        setTimeout(() => {
          const canvas = canvasRef.current;
          const ctx = contextRef.current || canvas?.getContext('2d');
          if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            saveToHistory();
            setLoading(false);
          }
        }, 100);
      };
      img.src = lockedNoteData.content;
    }
  }, [isVerified, lockedNoteData]);

  const getCoordinates = (e: React.PointerEvent | PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const updateCursorPosition = (x: number, y: number) => {
    if (cursorRef.current) {
      cursorRef.current.style.left = `${x}px`;
      cursorRef.current.style.top = `${y}px`;
      cursorRef.current.style.opacity = '1';
    }
  };

  const startDrawing = (e: React.PointerEvent) => {
    if (isLocked) return;
    
    // Capture pointer
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) {
      console.warn('Pointer capture failed', err);
    }
    
    const coords = getCoordinates(e);
    const { x, y } = coords;
    
    updateCursorPosition(e.clientX, e.clientY);

    pointsRef.current = [{ x, y }];
    isDrawingRef.current = true;
    setIsDrawing(true);
    
    const canvas = canvasRef.current;
    const ctx = contextRef.current || canvas?.getContext('2d');
    if (ctx) {
      contextRef.current = ctx;
      
      ctx.beginPath();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = 'source-over';
      
      ctx.moveTo(x, y);
      
      if (brushStyle === 'neon') {
        ctx.shadowBlur = size / 2;
        ctx.shadowColor = color;
      } else {
        ctx.shadowBlur = 0;
      }
      
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const draw = (e: React.PointerEvent) => {
    if (isLocked || !isDrawingRef.current) return;
    
    const ctx = contextRef.current || canvasRef.current?.getContext('2d');
    if (!ctx) return;
    
    updateCursorPosition(e.clientX, e.clientY);

    const coords = getCoordinates(e);
    const { x, y } = coords;
    const points = pointsRef.current;
    
    if (points.length === 0) return;
    const lastPoint = points[points.length - 1];

    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.globalAlpha = 1.0;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    switch (brushStyle) {
      case 'spray':
        for (let i = 0; i < 20; i++) {
          const offsetX = (Math.random() - 0.5) * size * 2.5;
          const offsetY = (Math.random() - 0.5) * size * 2.5;
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.arc(x + offsetX, y + offsetY, 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1.0;
        break;
      
      case 'sketch':
        points.push({ x, y });
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.15;
        for (let i = 0; i < points.length; i++) {
          const dx = points[i].x - x;
          const dy = points[i].y - y;
          if (dx * dx + dy * dy < 1000) {
            ctx.beginPath();
            ctx.moveTo(x + dx * 0.2, y + dy * 0.2);
            ctx.lineTo(points[i].x - dx * 0.2, points[i].y - dy * 0.2);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1.0;
        break;

      case 'neon':
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(x, y);
        ctx.shadowBlur = size / 2;
        ctx.shadowColor = color;
        ctx.stroke();
        ctx.shadowBlur = 0;
        points.push({ x, y });
        break;

      default:
        // Regular Round/Brush smoothing
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        points.push({ x, y });
    }
  };

  const handlePointerLeave = () => {
    if (cursorRef.current) cursorRef.current.style.opacity = '0';
  };

  const stopDrawing = (e: React.PointerEvent) => {
    if (isDrawingRef.current) {
      saveToHistory();
    }
    isDrawingRef.current = false;
    setIsDrawing(false);
    pointsRef.current = [];
    if (cursorRef.current) cursorRef.current.style.opacity = '0';
    
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {
      // Ignore capture release errors
    }
  };

  const saveCanvas = async (isAuto = false) => {
    if (!user || !canvasRef.current || isLocked) return null;
    
    setSaving(true);
    setSaveStatus('saving');
    
    // Create a temporary canvas with the page color as background
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasRef.current.width;
    tempCanvas.height = canvasRef.current.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.fillStyle = pageColor;
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.drawImage(canvasRef.current, 0, 0);
    }

    const canvasData = tempCanvas.toDataURL('image/png');
    const now = Date.now();
    
    // Use existing ID from ref or generate a new one ONCE
    const isNew = !noteIdRef.current;
    if (isNew) {
      noteIdRef.current = doc(collection(db, 'notes')).id;
    }
    const noteId = noteIdRef.current!;

    const noteData = {
      title: title || 'Untitled Sketch',
      content: canvasData,
      category: category,
      color: pageColor,
      userId: user.uid,
      updatedAt: now,
      type: 'drawing' as const,
      isLocked: isLocked
    };

    try {
      const docRef = doc(db, 'notes', noteId);
      if (isNew) {
        await setDoc(docRef, { ...noteData, createdAt: now });
      } else {
        await updateDoc(docRef, { ...noteData });
      }
      setSaveStatus('saved');
      if (id === 'new') {
        window.history.replaceState(null, '', `/canvas/${noteId}`);
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
    const savedId = await saveCanvas();
    if (savedId) navigate('/');
  };

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

  // Auto-save logic for canvas
  useEffect(() => {
    if (!autoSaveEnabled || (id === 'new' && !isDrawing && title === '') || isLocked) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    
    setSaveStatus('saving');
    autoSaveTimerRef.current = setTimeout(() => {
      saveCanvas(true);
    }, 4000); // 4 seconds after change

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [historyStep, autoSaveEnabled, title, pageColor, isLocked]);

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

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !contextRef.current || isLocked) return;
    contextRef.current.clearRect(0, 0, canvas.width, canvas.height);
    saveToHistory();
  };

  const BRUSH_STYLES = [
    { id: 'round', name: 'Round', icon: <CircleDot size={18} /> },
    { id: 'square', name: 'Square', icon: <Minus size={18} /> },
    { id: 'calligraphy', name: 'Calligraphy', icon: <BrushIcon size={18} /> },
    { id: 'spray', name: 'Spray', icon: <CircleDot size={18} className="opacity-40" /> },
    { id: 'neon', name: 'Neon', icon: <Palette size={18} className="text-yellow-400" /> },
    { id: 'sketch', name: 'Sketch', icon: <Settings2 size={18} /> },
    { id: 'dots', name: 'Dots', icon: <CircleDot size={10} /> },
    { id: 'ghost', name: 'Ghost', icon: <BrushIcon size={18} className="opacity-20" /> },
    { id: 'soft', name: 'Soft', icon: <CircleDot size={18} /> },
    { id: 'ribbon', name: 'Ribbon', icon: <Minus size={18} className="rotate-45" /> },
  ] as const;

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
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
              <h2 className="text-3xl font-black text-white tracking-tight mb-4 uppercase">Private Drawing</h2>
              <p className="text-slate-400 font-medium mb-12 leading-relaxed italic">
                This drawing is protected by PIN Shield. Please verify your identity to view the canvas.
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
                Go Back
              </button>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div 
            key="canvas-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex flex-col bg-white overflow-hidden transition-colors duration-500"
          >
            {/* Header - Back and Title */}
            <header className="h-20 px-6 flex items-center justify-between border-b border-slate-100 bg-white/95 backdrop-blur-xl shrink-0 z-50">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => navigate('/')}
                  className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all active:scale-95 border border-slate-200"
                  style={{ color: accentColor }}
                >
                  <ChevronLeft size={24} />
                </button>
                
                <div className="flex flex-col">
                  <div className="flex items-center gap-3">
                    <input 
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Sketch Title"
                      className="bg-transparent border-none p-0 focus:ring-0 font-black text-xl text-slate-900 placeholder:text-slate-300 w-32 sm:w-64"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden lg:flex items-center gap-1.5 mr-2">
                  <button 
                    onClick={undo}
                    disabled={historyStep <= 0}
                    className="p-3 hover:bg-slate-100 rounded-2xl transition-all disabled:opacity-20 text-slate-600"
                    title="Undo"
                  >
                    <RotateCcw size={20} className="-scale-x-100" />
                  </button>
                  <button 
                    onClick={redo}
                    disabled={historyStep >= history.length - 1}
                    className="p-3 hover:bg-slate-100 rounded-2xl transition-all disabled:opacity-20 text-slate-600"
                    title="Redo"
                  >
                    <RotateCcw size={20} />
                  </button>
                </div>

                <button 
                  disabled={saving}
                  onClick={handleManualSave}
                  className="flex items-center gap-2 text-white px-4 sm:px-8 py-3.5 rounded-[1.8rem] font-black transition-all active:scale-95 disabled:opacity-50 shadow-xl"
                  style={{ backgroundColor: accentColor, boxShadow: `0 10px 20px -5px ${accentColor}40` }}
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : <Save size={20} strokeWidth={3} />}
                  <span className="uppercase tracking-widest text-[10px] hidden sm:inline">Save</span>
                </button>
              </div>
            </header>


            {/* Canvas Area - Priority */}
            <main 
              className="flex-1 relative overflow-hidden select-none"
              style={{ backgroundColor: pageColor }}
            >
              <canvas
                ref={canvasRef}
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerLeave={handlePointerLeave}
                className="w-full h-full block cursor-none touch-none"
              />
              
              {/* Brush Indicator Overlay */}
              <div 
                ref={cursorRef}
                className="fixed pointer-events-none rounded-full border border-white/40 shadow-sm mix-blend-difference z-[100] transition-none opacity-0"
                style={{ 
                  width: size,
                  height: size,
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: color,
                  boxShadow: brushStyle === 'neon' ? `0 0 ${size}px ${color}` : 'none'
                }}
              />
            </main>

            <footer className="h-24 px-6 border-t border-slate-100 bg-white/95 backdrop-blur-xl shrink-0 z-[110] flex items-center justify-between transition-colors">
              <div className="flex items-center gap-1 sm:gap-6">
                {/* TOOL: COLOR PICKER */}
                <div className="relative">
                  <button 
                    onClick={() => {
                      setShowColorPicker(!showColorPicker);
                      setShowSizePicker(false);
                      setShowPageColorPicker(false);
                    }}
                    className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full border-4 border-white shadow-xl active:scale-90 transition-all flex items-center justify-center overflow-hidden"
                  >
                    <div className="w-full h-full" style={{ backgroundColor: color }} />
                  </button>

                  <AnimatePresence>
                    {showColorPicker && (
                      <>
                        <div className="fixed inset-0 z-[120]" onClick={() => setShowColorPicker(false)} />
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: -20 }}
                          exit={{ opacity: 0, scale: 0.9, y: -10 }}
                          className="absolute bottom-full left-0 mb-4 bg-white p-5 rounded-[2.5rem] shadow-2xl border border-slate-200 z-[130] w-[280px]"
                        >
                          <div className="grid grid-cols-6 gap-2">
                            {PRESET_COLORS.slice(0, 30).map((c, i) => (
                              <button
                                key={`${c}-${i}`}
                                onClick={() => {
                                  setColor(c);
                                  setShowColorPicker(false);
                                }}
                                className={cn(
                                  "w-8 h-8 rounded-xl border-2 transition-all hover:scale-110 active:scale-90",
                                  color === c ? "shadow-md" : "border-slate-50"
                                )}
                                style={{ 
                                  backgroundColor: c,
                                  borderColor: color === c ? accentColor : undefined
                                }}
                              />
                            ))}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                <div className="h-10 w-px bg-slate-200 hidden sm:block" />

                {/* TOOL: BRUSHES */}
                <div className="flex items-center gap-1 sm:gap-3">
                  <button 
                    onClick={() => setBrushStyle('round')}
                    className={cn(
                      "p-3 sm:p-4 rounded-2xl sm:rounded-3xl transition-all active:scale-90",
                      (brushStyle === 'round' || brushStyle === 'sketch') ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:bg-slate-100"
                    )}
                    title="Pencil"
                  >
                    <Pencil size={20} />
                  </button>
                  <button 
                    onClick={() => setBrushStyle('calligraphy')}
                    className={cn(
                      "p-3 sm:p-4 rounded-2xl sm:rounded-3xl transition-all active:scale-90",
                      (brushStyle === 'calligraphy' || brushStyle === 'soft') ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:bg-slate-100"
                    )}
                    title="Brush"
                  >
                    <Paintbrush size={20} />
                  </button>
                </div>

                <div className="h-10 w-px bg-slate-200 hidden sm:block" />

                {/* TOOL: THICKNESS DOTS */}
                <div className="flex items-center gap-2 sm:gap-4 px-2 sm:px-4 overflow-visible h-14">
                  {[4, 12, 24, 48].map((s) => (
                    <button 
                      key={s}
                      onClick={() => setSize(s)}
                      className={cn(
                        "rounded-full transition-all border-2 active:scale-75",
                        size === s ? "bg-slate-900 border-white scale-125 shadow-xl" : "bg-slate-200 border-transparent hover:bg-slate-300"
                      )}
                      style={{ 
                        width: Math.max(8, s/4), 
                        height: Math.max(8, s/4) 
                      }}
                      title={`${s}px thickness`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <button 
                    onClick={() => {
                      setShowPageColorPicker(!showPageColorPicker);
                      setShowColorPicker(false);
                      setShowSizePicker(false);
                    }}
                    className={cn(
                      "p-3 rounded-2xl transition-all active:scale-90 flex items-center gap-3 border shadow-sm",
                      showPageColorPicker ? "text-white" : "bg-white border-slate-100 text-slate-600"
                    )}
                    style={{ 
                      backgroundColor: showPageColorPicker ? accentColor : undefined,
                      borderColor: showPageColorPicker ? accentColor : undefined
                    }}
                  >
                    <Palette size={20} />
                    <span className="text-[10px] font-black uppercase tracking-widest hidden lg:inline">Theme</span>
                  </button>
                  
                  <AnimatePresence>
                    {showPageColorPicker && (
                      <>
                        <div className="fixed inset-0 z-[120]" onClick={() => setShowPageColorPicker(false)} />
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: -20 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute bottom-full right-0 mb-4 bg-white p-4 rounded-[2rem] shadow-2xl border border-slate-200 grid grid-cols-4 gap-2 w-[180px] z-[130]"
                        >
                          {PAGE_COLORS.map(c => (
                            <button
                              key={c}
                              onClick={() => {
                                setPageColor(c);
                                setShowPageColorPicker(false);
                              }}
                              className={cn(
                                "w-8 h-8 rounded-lg border-2 transition-all hover:scale-110",
                                pageColor === c ? "" : "border-slate-100"
                              )}
                              style={{ 
                                backgroundColor: c,
                                borderColor: pageColor === c ? accentColor : undefined
                              }}
                            />
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                {/* MORE ACTIONS ACCORDION/POPUP */}
                <div className="relative">
                  <button 
                    onClick={() => {
                      setShowSizePicker(!showSizePicker);
                      setShowColorPicker(false);
                      setShowPageColorPicker(false);
                    }}
                    className={cn(
                      "p-3 rounded-2xl bg-slate-50 text-slate-400 hover:bg-slate-100 transition-all active:scale-90 border border-slate-200"
                    )}
                  >
                    <Settings2 size={20} />
                  </button>

                  <AnimatePresence>
                    {showSizePicker && (
                      <>
                        <div className="fixed inset-0 z-[120]" onClick={() => setShowSizePicker(false)} />
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: -20 }}
                          exit={{ opacity: 0, scale: 0.9, y: 10 }}
                          className="absolute bottom-full right-0 mb-4 bg-white p-2 rounded-[2rem] shadow-2xl border border-slate-200 z-[130] w-48 overflow-hidden"
                        >
                          <button 
                            onClick={clearCanvas}
                            className="w-full flex items-center gap-3 px-5 py-4 text-rose-500 hover:bg-rose-50 rounded-[1.5rem] transition-all font-black uppercase tracking-widest text-[10px]"
                          >
                            <Eraser size={18} />
                            <span>Clear All</span>
                          </button>
                          
                          <button 
                            onClick={downloadCanvas}
                            className="w-full flex items-center gap-3 px-5 py-4 text-slate-600 hover:bg-slate-50 rounded-[1.5rem] transition-all font-black uppercase tracking-widest text-[10px]"
                          >
                            <Download size={18} />
                            <span>Export PNG</span>
                          </button>

                          <div className="h-px bg-slate-100 my-1 mx-2" />

                          <button 
                            onClick={() => {
                              setShowDeleteConfirm(true);
                              setShowSizePicker(false);
                            }}
                            className="w-full flex items-center gap-3 px-5 py-4 text-rose-600 hover:bg-rose-50 rounded-[1.5rem] transition-all font-black uppercase tracking-widest text-[10px]"
                          >
                            <Trash2 size={18} />
                            <span>Delete</span>
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Note Lock Modal */}
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
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/10 backdrop-blur-[4px]">
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
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Erase Drawing?</h3>
                <p className="text-sm text-slate-500 font-medium italic">Your artwork will be permanently erased. This cannot be undone.</p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleDelete}
                  className="w-full py-5 bg-rose-600 text-white rounded-[1.8rem] font-black uppercase tracking-[0.2em] shadow-xl shadow-rose-500/30 active:scale-95 transition-all"
                >
                  Yes, Erase it
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full py-4 text-slate-400 font-black uppercase tracking-widest text-[10px] hover:text-slate-600 transition-colors"
                >
                  Keep Drawing
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
