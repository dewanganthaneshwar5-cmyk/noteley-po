/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { Mail, Lock, User, ArrowRight, Chrome, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useState } from 'react';

export default function Signup() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingUp, setSigningUp] = useState(false);

  const handleGoogleSignup = async () => {
    try {
      setError(null);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/');
    } catch (err: any) {
      console.error("Google Signup Error:", err);
      if (err.code === 'auth/unauthorized-domain') {
        setError(`Domain Not Authorized: Please add "${window.location.hostname}" to your Firebase Console -> Authentication -> Settings -> Authorized domains.`);
      } else {
        setError(`${err.code}: ${err.message}`);
      }
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setSigningUp(true);
    setError(null);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      if (userCred.user) {
        await updateProfile(userCred.user, { displayName: fullName });
      }
      navigate('/');
    } catch (err: any) {
      console.error("Email Signup Error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError("This email is already registered. Please login instead.");
      } else if (err.code === 'auth/weak-password') {
        setError("Password should be at least 6 characters.");
      } else if (err.code === 'auth/invalid-email') {
        setError("Please enter a valid email address.");
      } else {
        setError(err.message || "An error occurred during signup.");
      }
    } finally {
      setSigningUp(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl mx-auto mb-8 flex items-center justify-center text-white shadow-2xl shadow-indigo-600/20">
            <User size={40} strokeWidth={2.5} />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Create Account</h1>
          <p className="text-slate-500 mt-3 font-medium text-sm">Start your productivity journey with Notely.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold uppercase tracking-wider text-center">
            {error}
          </div>
        )}

        <form className="space-y-6" onSubmit={handleEmailSignup}>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Full Name</label>
            <div className="relative">
              <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input 
                type="text" 
                placeholder="Rahul Dev"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full pl-14 pr-5 py-4 bg-white border-none rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-900 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input 
                type="email" 
                placeholder="hello@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-14 pr-5 py-4 bg-white border-none rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-900 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-14 pr-5 py-4 bg-white border-none rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-900 text-sm"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={signingUp}
            className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-3 hover:bg-indigo-700 active:scale-95 transition-all group mt-4 disabled:opacity-50"
          >
            {signingUp ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Joining...
              </>
            ) : (
              <>
                Join Notely
                <ArrowRight size={22} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-10 text-center">
          <p className="text-slate-400 text-sm font-bold">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 hover:underline">
              Log In
            </Link>
          </p>
        </div>

        <div className="mt-10 pt-10 border-t border-slate-200">
           <button 
            onClick={handleGoogleSignup}
            className="w-full flex items-center justify-center gap-3 py-4 bg-white border border-slate-100 rounded-2xl font-black text-sm text-slate-700 hover:bg-slate-50 shadow-sm transition-all active:scale-95"
           >
             <Chrome size={20} strokeWidth={2.5} />
             Continue with Google
           </button>
        </div>
      </motion.div>
    </div>
  );
}
