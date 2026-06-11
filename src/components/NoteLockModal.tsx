/**
 * @license
 * Copyright 2024 Google LLC
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Unlock, X, ShieldCheck, AlertCircle } from 'lucide-react';
import { useUI } from '../contexts/UIContext';

interface NoteLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (pin: string) => void;
  mode: 'lock' | 'unlock';
  title?: string;
  expectedPin?: string;
}

export default function NoteLockModal({ isOpen, onClose, onConfirm, mode, title, expectedPin }: NoteLockModalProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const { accentColor } = useUI();

  useEffect(() => {
    if (!isOpen) {
      setPin('');
      setConfirmPin('');
      setStep(1);
      setError('');
    }
  }, [isOpen]);

  const handleKeyPress = (num: string) => {
    setError('');
    if (step === 1 && pin.length < 6) {
      setPin(prev => prev + num);
    } else if (step === 2 && confirmPin.length < 6) {
      setConfirmPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    if (step === 1) setPin(prev => prev.slice(0, -1));
    else setConfirmPin(prev => prev.slice(0, -1));
  };

  const handleNext = () => {
    if (pin.length !== 6) {
      setError(mode === 'lock' ? 'Please enter a 6-digit PIN' : 'Please enter your 6-digit PIN');
      return;
    }

    if (mode === 'lock') {
      setStep(2);
    } else {
      if (expectedPin && pin !== expectedPin) {
        setError('Incorrect PIN');
        setPin('');
        return;
      }
      onConfirm(pin);
    }
  };

  const handleFinish = () => {
    if (confirmPin !== pin) {
      setError('PINs do not match');
      setConfirmPin('');
      return;
    }
    onConfirm(pin);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-md"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[3rem] overflow-hidden shadow-2xl border border-white/20 dark:border-slate-800"
        >
          <div className="p-8 text-center">
            <div className="flex justify-center mb-6">
              <div 
                className="w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg"
                style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
              >
                {mode === 'lock' ? <Lock size={32} /> : <Unlock size={32} />}
              </div>
            </div>
            
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              {mode === 'lock' 
                ? (step === 1 ? 'Set Note PIN' : 'Confirm PIN')
                : 'Unlock Note'
              }
            </h2>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2 mb-8">
              {title || 'Secure your private information'}
            </p>

            {/* PIN Display */}
            <div className="flex justify-center gap-3 mb-8">
              {[...Array(6)].map((_, i) => {
                const currentVal = step === 1 ? pin : confirmPin;
                const isActive = currentVal.length === i;
                const isFilled = currentVal.length > i;
                return (
                  <motion.div
                    key={i}
                    animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                    className={`w-4 h-4 rounded-full border-2 transition-all ${
                      isFilled 
                        ? 'bg-slate-900 border-slate-900 dark:bg-white dark:border-white' 
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  />
                );
              })}
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 flex items-center justify-center gap-2 text-rose-500 font-black uppercase tracking-widest text-[10px]"
              >
                <AlertCircle size={14} />
                {error}
              </motion.div>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() => handleKeyPress(num.toString())}
                  className="h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-black text-xl hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-90 transition-all shadow-sm"
                >
                  {num}
                </button>
              ))}
              <div />
              <button
                onClick={() => handleKeyPress('0')}
                className="h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-black text-xl hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-90 transition-all shadow-sm"
              >
                0
              </button>
              <button
                onClick={handleDelete}
                className="h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center active:scale-90 transition-all shadow-sm"
              >
                <X size={20} strokeWidth={3} />
              </button>
            </div>

            <div className="flex gap-4">
              <button
                onClick={onClose}
                className="flex-1 p-5 rounded-[1.8rem] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest text-xs active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={step === 1 ? handleNext : handleFinish}
                className="flex-1 p-5 rounded-[1.8rem] text-white font-black uppercase tracking-widest text-xs active:scale-95 transition-all shadow-xl"
                style={{ backgroundColor: accentColor }}
              >
                {step === 1 ? (mode === 'lock' ? 'Next' : 'Unlock') : 'Confirm'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
