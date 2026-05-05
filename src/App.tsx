import { motion, AnimatePresence } from "motion/react";
import { Bot, Globe, Zap, ArrowRight, MessageSquare, Layout, Activity, Trash2 } from "lucide-react";
import { useState, FormEvent, useEffect } from "react";
import { api } from "./services/gemini";
import { auth } from "./lib/firebase";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode
} from "firebase/auth";

import { 
  collection, 
  addDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  orderBy, 
  updateDoc, 
  doc, 
  serverTimestamp,
  setDoc,
  getDoc,
  deleteDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from "./lib/firebase";
import { generateBlogContent } from "./lib/gemini";
import ReactMarkdown from 'react-markdown';

// --- Components ---

const SettingsModal = ({ isOpen, onClose, user }: { isOpen: boolean, onClose: () => void, user: any }) => {
  const [displayName, setDisplayName] = useState(user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName,
        bio,
      });
      onClose();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl relative"
      >
        <button onClick={onClose} className="absolute top-8 right-8 text-gray-400 hover:text-black">
          <Zap size={24} className="rotate-45" />
        </button>
        <h2 className="text-3xl font-bold mb-8">Profile Settings</h2>
        {error && <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-xl text-xs">{error}</div>}
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block">Display Name</label>
            <input 
              className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:border-black"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block">Bio</label>
            <textarea 
              className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:border-black resize-none"
              rows={3}
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
            />
          </div>
          <button 
            disabled={isSaving}
            className="w-full bg-black text-white py-5 rounded-2xl font-bold hover:bg-gray-800 transition-all disabled:opacity-50"
          >
            {isSaving ? <Activity className="animate-spin mx-auto" /> : 'Save Changes'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const AuthModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [view, setView] = useState<'login' | 'signup' | 'forgotPassword' | 'resetPassword'>('login');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [oobCode, setOobCode] = useState<string | null>(null);

  useEffect(() => {
    // Detect reset mode from URL
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const code = params.get('oobCode');
    if (mode === 'resetPassword' && code) {
      setOobCode(code);
      setView('resetPassword');
      // Verify code validity
      verifyPasswordResetCode(auth, code)
        .then((email) => {
          setSuccess(`Resetting password for ${email}`);
        })
        .catch((err) => {
          setError("This password reset link is invalid or has expired.");
          setView('login');
        });
    }
  }, []);

  if (!isOpen) return null;

  const isSignUp = view === 'signup';
  const isForgotPassword = view === 'forgotPassword';
  const isResetPassword = view === 'resetPassword';

  const validatePassword = (pass: string) => {
    const hasAlpha = /[a-zA-Z]/.test(pass);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
    const isLongEnough = pass.length >= 8;
    return hasAlpha && hasSymbol && isLongEnough;
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const provider = new GoogleAuthProvider();
      // Using signInWithPopup but catching common mobile blocks
      await signInWithPopup(auth, provider);
      onClose();
    } catch (err: any) {
      if (err.code === 'auth/popup-blocked') {
        setError("Popup blocked. Please open this app in a new tab or browser (like Chrome/Safari) to use Google Sign-In.");
      } else if (err.code === 'auth/unauthorized-domain') {
        setError("Domain not authorized. Add your domain to 'Authorized domains' in Firebase Console (Authentication > Settings).");
      } else if (err.code === 'auth/operation-not-allowed') {
        setError("Email/Password auth is not enabled in Firebase Console (Authentication > Sign-in method).");
      } else if (err.code === 'auth/invalid-credential') {
        setError("Invalid email or password. If you haven't registered yet, please click 'Join the waitlist' below.");
      } else if (err.code === 'auth/user-not-found') {
        setError("No account found with this email. Please sign up first.");
      } else if (err.code === 'auth/wrong-password') {
        setError("Incorrect password. Please try again.");
      } else if (err.code === 'auth/cancelled-popup-request') {
        // User closed the popup, don't show as a scary error
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // Still try to send the email in the background
      await sendPasswordResetEmail(auth, email);
      setSuccess("We've sent a link, but you can continue to the reset screen below for the demo.");
      // Move to reset view immediately so user can see it
      setTimeout(() => {
        setView('resetPassword');
        setSuccess(null);
      }, 1500);
    } catch (err: any) {
      // If email sending fails (e.g. invalid project config), still allow proceeding for the demo
      setError(`${err.message} (Proceeding to demo reset screen...)`);
      setTimeout(() => {
        setView('resetPassword');
        setError(null);
      }, 2000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordConfirm = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      if (oobCode) {
        // Real reset if we have the code
        await confirmPasswordReset(auth, oobCode, newPassword);
        setSuccess("Password updated successfully!");
        setTimeout(() => setView('login'), 2000);
      } else {
        // Demo mode: simulate success
        setSuccess("Demo: Password reset successfully simulated!");
        setTimeout(() => setView('login'), 2500);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isForgotPassword) {
      handleForgotPassword(e);
      return;
    }
    if (isResetPassword) {
      handleResetPasswordConfirm(e);
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    if (isSignUp && !validatePassword(password)) {
      setError("Password must be at least 8 characters long and include both alphabets and symbols.");
      setIsLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        setSuccess("Verification email sent! Check your inbox.");
        setEmail("");
        setPassword("");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        onClose();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md overflow-y-auto pt-10 sm:pt-0">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-[2.5rem] p-6 sm:p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] relative my-auto"
      >
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 sm:top-8 sm:right-8 p-2 text-gray-400 hover:text-black hover:bg-gray-50 rounded-full transition-all"
        >
          <Zap size={20} className="rotate-45" />
        </button>
        
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-black/20">
            <Zap size={24} />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">
            {isSignUp ? 'Join EngageFlow' : isForgotPassword ? 'Reset Password' : isResetPassword ? 'Set New Password' : 'Welcome Back'}
          </h2>
          <p className="text-gray-500 text-sm mt-2">
            {isForgotPassword ? 'We will send you a link to reset your password.' : isResetPassword ? 'Choose a secure new password.' : 'Start automating your growth today.'}
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-[10px] font-bold uppercase tracking-tight"
          >
            {error}
          </motion.div>
        )}

        {success && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600 text-[10px] font-bold uppercase tracking-tight"
          >
            {success}
          </motion.div>
        )}

        {!isForgotPassword && !isResetPassword && (
          <>
            <button 
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 py-4 rounded-2xl font-bold hover:bg-gray-50 transition-all mb-6 text-sm active:scale-[0.98]"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              Continue with Google
            </button>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest"><span className="bg-white px-4 text-gray-400">Or use email</span></div>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isResetPassword && (
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Email Address</label>
              <input 
                required
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:border-black transition-colors text-base"
                placeholder="name@company.com"
              />
            </div>
          )}
          {!isForgotPassword && !isResetPassword && (
            <div>
              <div className="flex justify-between items-center mb-1 ml-1 leading-none">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Password</label>
                {!isSignUp && (
                  <button 
                    type="button" 
                    onClick={() => setView('forgotPassword')}
                    className="text-[10px] font-bold text-black uppercase tracking-widest hover:underline"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <input 
                required
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:border-black transition-colors text-base"
                placeholder="••••••••"
              />
            </div>
          )}
          {isResetPassword && (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Create New Password</label>
                <div className="relative">
                  <input 
                    required
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:border-black transition-colors text-base"
                    placeholder="Min. 8 characters"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Confirm New Password</label>
                <div className="relative">
                  <input 
                    required
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:border-black transition-colors text-base"
                    placeholder="Repeat password"
                  />
                </div>
              </div>
            </div>
          )}
          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-black text-white py-5 rounded-[1.25rem] font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? <Activity size={20} className="animate-spin" /> : (isSignUp ? 'Create Account' : isForgotPassword ? 'Continue to Reset' : isResetPassword ? 'Set New Password' : 'Sign In')}
          </button>
        </form>

        <div className="mt-8 text-center leading-relaxed">
          <p className="text-gray-500 text-xs font-medium">
            {isSignUp ? 'Already have an account?' : (isForgotPassword || isResetPassword) ? 'Wait, I remember it!' : "Don't have an account?"}
            {' '}
            <button 
              type="button"
              onClick={() => {
                setError(null);
                setSuccess(null);
                setView(isForgotPassword || isResetPassword ? 'login' : isSignUp ? 'login' : 'signup');
              }}
              className="text-black font-bold border-b border-black pb-0.5 hover:opacity-70 transition-opacity"
            >
              {isSignUp ? 'Sign In' : (isForgotPassword || isResetPassword) ? 'Back to Login' : 'Join the waitlist'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

const Navbar = ({ onOpenAuth, onOpenSettings, user, onLogout }: { onOpenAuth: () => void, onOpenSettings: () => void, user: any, onLogout: () => void }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <span className="font-sans font-bold text-xl tracking-tight">EngageFlow</span>
        </div>
        
        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-8 text-sm font-medium text-gray-600">
          <a href="#features" className="hover:text-black transition-colors">Features</a>
          <a href="#demo" className="hover:text-black transition-colors">Tools</a>
          <a href="#calculator" className="hover:text-black transition-colors">ROI Cal</a>
          <a href="#blog" className="hover:text-black transition-colors">Blog</a>
          <a href="#contact" className="hover:text-black transition-colors">Contact</a>
        </div>

        <div className="hidden lg:flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex flex-col items-end">
                <span className="font-medium text-gray-900 leading-none">Hello, {user.name}</span>
                {user.role === 'admin' && (
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] font-bold text-indigo-600 uppercase tracking-widest">Founding Admin</span>
                    <div className="flex gap-2 items-center mt-1">
                      <a 
                        href="#admin-panel" 
                        className="bg-black text-white text-[9px] font-black uppercase tracking-[0.1em] px-3 py-1.5 rounded-full hover:scale-105 transition-transform shadow-lg shadow-black/10"
                      >
                        Launch Control
                      </a>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 ml-2 pl-4 border-l border-gray-100">
                <button onClick={onOpenSettings} className="text-gray-400 hover:text-black font-bold uppercase tracking-widest text-[10px]">Settings</button>
                <button onClick={onLogout} className="text-red-400 hover:text-red-600 font-bold uppercase tracking-widest text-[10px]">Logout</button>
              </div>
            </div>
          ) : (
            <button onClick={onOpenAuth} className="bg-black text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-gray-800 transition-colors">
              Get Started
            </button>
          )}
        </div>

        {/* Mobile Toggle */}
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="lg:hidden p-2 text-black">
          <div className={`w-6 h-0.5 bg-black mb-1.5 transition-all ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <div className={`w-6 h-0.5 bg-black mb-1.5 transition-all ${isMenuOpen ? 'opacity-0' : ''}`} />
          <div className={`w-6 h-0.5 bg-black transition-all ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="lg:hidden absolute top-20 left-0 right-0 bg-white border-b border-gray-100 p-8 flex flex-col gap-6 shadow-2xl">
          <a href="#features" onClick={() => setIsMenuOpen(false)} className="text-xl font-bold">Features</a>
          <a href="#demo" onClick={() => setIsMenuOpen(false)} className="text-xl font-bold">Tools</a>
          <a href="#pricing" onClick={() => setIsMenuOpen(false)} className="text-xl font-bold">Pricing</a>
          <a href="#blog" onClick={() => setIsMenuOpen(false)} className="text-xl font-bold">Blog</a>
          <a href="#contact" onClick={() => setIsMenuOpen(false)} className="text-xl font-bold">Contact</a>
          <hr className="border-gray-100" />
          {user ? (
            <div className="flex flex-col gap-4">
              <p className="font-bold text-gray-400 uppercase text-xs tracking-widest">Signed in as {user.name}</p>
              <button onClick={() => { onLogout(); setIsMenuOpen(false); }} className="bg-red-50 text-red-500 py-4 rounded-xl font-bold">Logout</button>
            </div>
          ) : (
            <button onClick={() => { onOpenAuth(); setIsMenuOpen(false); }} className="w-full bg-black text-white py-4 rounded-xl font-bold">
              Get Started
            </button>
          )}
        </div>
      )}
    </nav>
  );
};

const Hero = ({ onOpenAuth }: { onOpenAuth: () => void }) => (
  <section className="pt-40 pb-24 px-6">
    <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <span className="inline-block px-4 py-1.5 bg-gray-100 text-gray-900 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
          The Future of Customer Engagement
        </span>
        <h1 className="text-6xl md:text-7xl font-sans font-semibold tracking-tight leading-[1.05] mb-8">
          Engage your customers <br />
          <span className="text-gray-400">with precision.</span>
        </h1>
        <p className="text-lg text-gray-600 leading-relaxed max-w-xl mb-10">
          Scale your business with AI-powered chatbots, instant website samples, and powerful 
          customer service automations designed for modern growth.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={onOpenAuth}
            className="bg-black text-white px-8 py-4 rounded-full font-medium flex items-center justify-center gap-2 hover:bg-gray-800 transition-all shadow-lg shadow-gray-200"
          >
            Start Free Trial <ArrowRight size={18} />
          </button>
          <a 
            href="#demo"
            className="border border-gray-200 px-8 py-4 rounded-full font-medium hover:bg-gray-50 transition-all flex items-center justify-center"
          >
            Explore the Tools
          </a>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="relative aspect-square lg:aspect-video rounded-3xl overflow-hidden shadow-2xl bg-gray-900"
      >
        <img 
          src="https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=2070&auto=format&fit=crop" 
          alt="Business automation dashboard"
          className="w-full h-full object-cover opacity-80"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-8 left-8 p-6 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl max-w-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-white text-xs font-bold uppercase tracking-widest">Live Automation active</span>
          </div>
          <p className="text-white/80 text-sm">"AI just resolved a shipping inquiry for a customer in New York."</p>
        </div>
      </motion.div>
    </div>
  </section>
);

const GrowthCalculator = () => {
  const [leads, setLeads] = useState(100);
  const [conversion, setConversion] = useState(2);
  const [value, setValue] = useState(500);

  const monthlyRevenue = (leads * (conversion / 100)) * value;
  const aiBoost = monthlyRevenue * 0.45; // Simulated 45% boost

  return (
    <section className="py-24 px-6">
      <div className="max-w-7xl mx-auto flex flex-col items-center">
        <h2 className="text-4xl font-sans font-bold tracking-tight mb-16 text-center">Calculate your <br /> automation upside.</h2>
        <div className="w-full max-w-5xl grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-10">
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Monthly Leads</label>
                <span className="text-2xl font-bold">{leads.toLocaleString()}</span>
              </div>
              <input type="range" min="10" max="5000" step="10" value={leads} onChange={e => setLeads(Number(e.target.value))} className="w-full accent-black cursor-pointer" />
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Conversion Rate (%)</label>
                <span className="text-2xl font-bold">{conversion}%</span>
              </div>
              <input type="range" min="0.1" max="10" step="0.1" value={conversion} onChange={e => setConversion(Number(e.target.value))} className="w-full accent-black cursor-pointer" />
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Avg Customer Value ($)</label>
                <span className="text-2xl font-bold">${value.toLocaleString()}</span>
              </div>
              <input type="range" min="50" max="10000" step="50" value={value} onChange={e => setValue(Number(e.target.value))} className="w-full accent-black cursor-pointer" />
            </div>
          </div>

          <div className="bg-black rounded-[3rem] p-12 text-white shadow-[0_40px_80px_-15px_rgba(0,0,0,0.5)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-8">Estimated Monthly Revenue</p>
            <h3 className="text-6xl font-bold mb-12">${monthlyRevenue.toLocaleString()}</h3>
            
            <div className="p-8 bg-white/5 border border-white/10 rounded-3xl">
              <div className="flex items-center gap-3 mb-3">
                <Zap className="text-amber-400" size={20} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">EngageFlow Boost (+45%)</span>
              </div>
              <p className="text-3xl font-bold">+ ${aiBoost.toLocaleString()}</p>
              <p className="text-white/40 text-xs mt-2 italic">Based on average customer results using our automation engine.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
const FeatureCard = ({ icon: Icon, title, description, color }: { icon: any, title: string, description: string, color: string }) => (
  <div className="p-8 rounded-3xl border border-gray-100 bg-white hover:border-gray-200 hover:shadow-xl hover:shadow-gray-100 transition-all group">
    <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
      <Icon className="text-white" size={24} />
    </div>
    <h3 className="text-xl font-bold mb-3">{title}</h3>
    <p className="text-gray-600 leading-relaxed">{description}</p>
  </div>
);

const Features = () => (
  <section id="features" className="py-24 px-6 bg-gray-50">
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-sans font-bold tracking-tight mb-4">Powerful tools for growth</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">Everything you need to automate interactions and engage with your audience more effectively.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-8">
        <FeatureCard 
          icon={Bot} 
          title="Smart Chatbots" 
          description="Deploy intelligent conversational agents that learn from your documentation and resolve issues 24/7."
          color="bg-indigo-600"
        />
        <FeatureCard 
          icon={Globe} 
          title="Website Samples" 
          description="Instantly generate structured landing pages and service samples to test new business ideas."
          color="bg-emerald-600"
        />
        <FeatureCard 
          icon={Zap} 
          title="Seamless Automation" 
          description="Connect your customer service workflows to your favorite tools and eliminate manual repetitive tasks."
          color="bg-amber-600"
        />
      </div>
    </div>
  </section>
);

const AIDemo = () => {
  const [activeTab, setActiveTab] = useState<'chatbot' | 'website' | 'builder' | 'automations'>('chatbot');
  const [selectedTheme, setSelectedTheme] = useState('Modern Minimalist');
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{role: 'user' | 'ai', text: string}[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [websiteSample, setWebsiteSample] = useState<string | null>(null);
  const [trialCount, setTrialCount] = useState(0);
  const [isCustomTheme, setIsCustomTheme] = useState(false);
  const [customThemeInput, setCustomThemeInput] = useState('');
  const TRIAL_LIMIT = 3;

  // Website Builder State
  const [builderReqs, setBuilderReqs] = useState('');
  const [builtWebsite, setBuiltWebsite] = useState<string | null>(null);

  // Chatbot Builder State
  const [botConfig, setBotConfig] = useState({ name: '', purpose: '', avatar: '🤖', speed: 'normal' });
  const [isBotReady, setIsBotReady] = useState(false);

  const themes = [
    { name: 'Modern Minimalist', desc: 'Clean, spacious, and elegant', icon: Layout },
    { name: 'High-Tech Dark', desc: 'Neon accents and dark aesthetics', icon: Activity },
    { name: 'Soft & Warm', desc: 'Friendly pastels and rounded feel', icon: MessageSquare },
    { name: 'Corporate Professional', desc: 'Trustworthy and structured', icon: Globe },
  ];

  const handleChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    setIsGenerating(true);

    try {
      const startTime = Date.now();
      const result = await api.chat(userMsg, botConfig.name, botConfig.purpose, messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      })));
      
      // Simulate response speed
      const delay = botConfig.speed === 'slow' ? 2000 : botConfig.speed === 'fast' ? 200 : 700;
      const elapsedTime = Date.now() - startTime;
      const waitTime = Math.max(0, delay - elapsedTime);
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      setMessages(prev => [...prev, { role: 'ai', text: result.text || "I couldn't process that right now." }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'ai', text: "Service is temporarily unavailable." }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBuildWebsite = async () => {
    if (!builderReqs.trim()) return;
    setIsGenerating(true);
    setBuiltWebsite(null);
    try {
      const result = await api.generateWebsite("Custom Requirement: " + builderReqs, "High Fidelity / Fully Functional Preview");
      setBuiltWebsite(result.text);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const startBotTrial = (e: FormEvent) => {
    e.preventDefault();
    if (botConfig.name && botConfig.purpose) {
      setIsBotReady(true);
    }
  };

  const generateWebsite = async (type: string) => {
    if (trialCount >= TRIAL_LIMIT) return;
    
    setIsGenerating(true);
    setWebsiteSample(null);
    try {
      const finalTheme = isCustomTheme ? customThemeInput : selectedTheme;
      const result = await api.generateWebsite(type, finalTheme);
      setWebsiteSample(result.text || "Failed to generate sample.");
      setTrialCount(prev => prev + 1);
    } catch (error) {
       console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section id="demo" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-12 items-start">
          <div className="lg:col-span-2">
            <h2 className="text-4xl font-sans font-bold tracking-tight mb-6">Experience the power <br /> of BizAI.</h2>
            <p className="text-gray-600 mb-8 leading-relaxed">
              Experience how EngageFlow transforms static business needs into dynamic, automated solutions.
            </p>
            <div className="space-y-4">
              <button 
                onClick={() => setActiveTab('chatbot')}
                className={`w-full flex items-center gap-4 p-5 rounded-2xl transition-all ${activeTab === 'chatbot' ? 'bg-black text-white shadow-xl shadow-gray-200' : 'bg-gray-100 hover:bg-gray-200'}`}
              >
                <div className={`p-3 rounded-xl ${activeTab === 'chatbot' ? 'bg-white/20' : 'bg-white border border-gray-200 text-black'}`}>
                  <MessageSquare size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold">Chatbot Playground</p>
                  <p className={`text-xs opacity-60`}>Test smart customer support</p>
                </div>
              </button>
              <button 
                onClick={() => setActiveTab('website')}
                className={`w-full flex items-center gap-4 p-5 rounded-2xl transition-all ${activeTab === 'website' ? 'bg-black text-white shadow-xl shadow-gray-200' : 'bg-gray-100 hover:bg-gray-200'}`}
              >
                <div className={`p-3 rounded-xl ${activeTab === 'website' ? 'bg-white/20' : 'bg-white border border-gray-200 text-black'}`}>
                  <Layout size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold">Website Generator</p>
                  <p className={`text-xs opacity-60`}>Instantly prototype layouts</p>
                </div>
              </button>
              <button 
                onClick={() => setActiveTab('builder')}
                className={`w-full flex items-center gap-4 p-5 rounded-2xl transition-all ${activeTab === 'builder' ? 'bg-black text-white shadow-xl shadow-gray-200' : 'bg-gray-100 hover:bg-gray-200'}`}
              >
                <div className={`p-3 rounded-xl ${activeTab === 'builder' ? 'bg-white/20' : 'bg-white border border-gray-200 text-black'}`}>
                  <Layout size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold">Full Website Builder</p>
                  <p className={`text-xs opacity-60 text-current`}>Describe custom requirements</p>
                </div>
              </button>
            </div>
          </div>

          <div className="lg:col-span-3 bg-white rounded-[2rem] border border-gray-100 shadow-2xl shadow-gray-200 overflow-hidden min-h-[600px] flex flex-col">
            <div className="bg-gray-50 px-8 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">
                {activeTab === 'chatbot' ? 'Bot.Engine_v3' : activeTab === 'website' ? 'SiteBuilder_v1' : 'WebArchitect_v4'}
              </span>
            </div>

            <div className="flex-1 p-8 overflow-y-auto">
              {activeTab === 'chatbot' ? (
                <div className="h-full flex flex-col">
                  {!isBotReady ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto">
                      <div className="w-16 h-16 bg-black text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                        <Bot size={32} />
                      </div>
                      <h3 className="text-2xl font-bold mb-2">Build Your Trial Bot</h3>
                      <p className="text-gray-500 mb-8">Give your AI a name and a mission to see it in action.</p>
                      
                      <form onSubmit={startBotTrial} className="w-full space-y-4">
                        <div className="text-left">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">Bot Name</label>
                          <input 
                            required
                            type="text" 
                            placeholder="e.g. Luna Support"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-black transition-colors"
                            value={botConfig.name}
                            onChange={e => setBotConfig({...botConfig, name: e.target.value})}
                          />
                        </div>
                        <div className="text-left">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">Bot Purpose</label>
                          <textarea 
                            required
                            placeholder="e.g. Help customers track orders and answer FAQs about our organic coffee shop."
                            rows={3}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-black transition-colors resize-none"
                            value={botConfig.purpose}
                            onChange={e => setBotConfig({...botConfig, purpose: e.target.value})}
                          />
                        </div>
                        <button className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2">
                          Launch Trial Bot <ArrowRight size={18} />
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between bg-black/5 p-4 rounded-2xl border border-black/10">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-black text-white rounded-lg flex items-center justify-center font-bold">
                            {botConfig.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-sm leading-none mb-1">{botConfig.name} {botConfig.avatar}</p>
                            <p className="text-[10px] text-gray-500 italic truncate max-w-[200px]">{botConfig.purpose}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <button 
                            onClick={() => { setIsBotReady(false); setMessages([]); }}
                            className="text-[10px] font-bold text-black border-b border-black hover:opacity-60"
                          >
                            EDIT BOT
                          </button>
                        </div>
                      </div>

                      {/* Customization Options */}
                      <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Avatar</label>
                          <div className="flex gap-2">
                            {['🤖', '💬', '👤', '🏢', '✨'].map(emoji => (
                              <button 
                                key={emoji}
                                onClick={() => setBotConfig({ ...botConfig, avatar: emoji })}
                                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${botConfig.avatar === emoji ? 'bg-black text-white' : 'bg-white border border-gray-200 hover:border-gray-400'}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Speed</label>
                          <div className="flex bg-white rounded-lg p-1 border border-gray-100">
                            {(['slow', 'normal', 'fast'] as const).map(s => (
                              <button 
                                key={s}
                                onClick={() => setBotConfig({ ...botConfig, speed: s })}
                                className={`flex-1 text-[10px] font-bold uppercase py-1 px-2 rounded-md transition-all ${botConfig.speed === s ? 'bg-black text-white' : 'text-gray-400 hover:text-black'}`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {messages.length === 0 && (
                        <div className="text-center py-12">
                          <p className="text-gray-400 text-sm italic">"Hello! I'm {botConfig.name}. How can I assist your business today?"</p>
                        </div>
                      )}
                      {messages.map((m, i) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, x: m.role === 'user' ? 10 : -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`flex items-start gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          {m.role === 'ai' && (
                            <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center text-sm shrink-0 mt-1">
                              {botConfig.avatar}
                            </div>
                          )}
                          <div className={`max-w-[80%] p-4 rounded-2xl ${m.role === 'user' ? 'bg-black text-white shadow-lg' : 'bg-gray-100 text-gray-900 border border-gray-200'}`}>
                            <p className="text-sm leading-relaxed">{m.text}</p>
                          </div>
                        </motion.div>
                      ))}
                      {isGenerating && (
                        <div className="flex justify-start">
                          <div className="bg-gray-100 p-4 rounded-2xl animate-pulse">
                            <div className="w-12 h-2 bg-gray-300 rounded" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : activeTab === 'website' ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                   {trialCount >= TRIAL_LIMIT && !websiteSample ? (
                     <div className="max-w-md mx-auto">
                        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                          <Zap size={32} />
                        </div>
                        <h3 className="text-2xl font-bold mb-3">Trial Limit Reached</h3>
                        <p className="text-gray-500 mb-8">You've generated {TRIAL_LIMIT} free samples. Join EngageFlow to unlock unlimited generations and professional exports.</p>
                        <button className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2">
                          Sign Up for Full Access <ArrowRight size={18} />
                        </button>
                        <button 
                          onClick={() => setTrialCount(0)}
                          className="mt-4 text-[10px] text-gray-400 hover:text-black uppercase font-bold tracking-widest"
                        >
                          Reset Demo (Local Only)
                        </button>
                     </div>
                   ) : websiteSample ? (
                     <div className="w-full text-left bg-gray-50 p-8 rounded-2xl border border-gray-200">
                        <div className="prose prose-sm max-w-none">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-black font-bold uppercase tracking-tighter text-2xl">Preview</h3>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] bg-black/5 text-black px-2 py-0.5 rounded uppercase font-bold tracking-widest leading-normal">
                                {trialCount}/{TRIAL_LIMIT} TRIALS
                              </span>
                              <span className="text-[10px] bg-black text-white px-2 py-0.5 rounded uppercase font-bold tracking-widest leading-normal">
                                {isCustomTheme ? customThemeInput : selectedTheme}
                              </span>
                            </div>
                          </div>
                          <div className="whitespace-pre-wrap text-gray-700">{websiteSample}</div>
                        </div>
                     </div>
                   ) : (
                     <div className="max-w-xl w-full">
                        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                          <Globe size={32} />
                        </div>
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <h3 className="text-xl font-bold">Generate a Sample</h3>
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                            {TRIAL_LIMIT - trialCount} FREE REMAINING
                          </span>
                        </div>
                        <p className="text-gray-500 mb-8">Select a theme and business type to begin.</p>
                        
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          {themes.map(t => (
                            <button
                              key={t.name}
                              onClick={() => { setSelectedTheme(t.name); setIsCustomTheme(false); }}
                              className={`p-4 rounded-xl border text-left transition-all ${!isCustomTheme && selectedTheme === t.name ? 'border-black bg-black text-white' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                            >
                              <p className="text-xs font-bold mb-1">{t.name}</p>
                              <p className={`text-[10px] ${!isCustomTheme && selectedTheme === t.name ? 'text-white/60' : 'text-gray-400'}`}>{t.desc}</p>
                            </button>
                          ))}
                        </div>

                        <div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
                          <label className="flex items-center gap-2 cursor-pointer mb-3">
                            <input 
                              type="checkbox" 
                              checked={isCustomTheme} 
                              onChange={(e) => setIsCustomTheme(e.target.checked)}
                              className="w-4 h-4 accent-black" 
                            />
                            <span className="text-xs font-bold uppercase tracking-widest">Or describe your own theme</span>
                          </label>
                          {isCustomTheme && (
                            <input 
                              type="text" 
                              placeholder="e.g. Brutalist Neon, Cyberpunk, 90s Retro..."
                              className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black"
                              value={customThemeInput}
                              onChange={(e) => setCustomThemeInput(e.target.value)}
                            />
                          )}
                        </div>

                        <div className="flex flex-wrap justify-center gap-2">
                          {['SaaS Startup', 'Modern Bakery', 'Consulting Firm', 'E-commerce Store'].map(cat => (
                            <button 
                              key={cat}
                              disabled={isGenerating || trialCount >= TRIAL_LIMIT}
                              onClick={() => generateWebsite(cat)}
                              className="px-4 py-2 border border-gray-200 rounded-full text-sm hover:border-black hover:text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                     </div>
                   )}
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  {builtWebsite ? (
                    <div className="p-2 md:p-6">
                       <div className="bg-gray-900 px-6 py-3 rounded-t-2xl flex items-center justify-between">
                          <div className="flex gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-400" />
                            <div className="w-2 h-2 rounded-full bg-amber-400" />
                            <div className="w-2 h-2 rounded-full bg-emerald-400" />
                          </div>
                          <span className="text-[10px] text-white/40 font-mono tracking-widest uppercase">Custom_Draft_Preview.html</span>
                       </div>
                       <div className="bg-white border transition-all border-gray-200 border-t-0 p-6 md:p-8 rounded-b-2xl shadow-sm">
                          <div className="prose prose-sm max-w-none">
                             <div className="whitespace-pre-wrap text-gray-700 leading-relaxed text-sm md:text-base">{builtWebsite}</div>
                          </div>
                          <button 
                            onClick={() => setBuiltWebsite(null)}
                            className="mt-8 text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-1 hover:text-black"
                          >
                            Edit Requirements
                          </button>
                       </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto p-4">
                       <div className="w-16 h-16 bg-black text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                        <Layout size={32} />
                      </div>
                      <h3 className="text-2xl font-bold mb-2">Requirement-Led Builder</h3>
                      <p className="text-gray-500 mb-8 text-sm">Describe exactly what your business needs. We'll architect a fully functional structural draft.</p>
                      
                      <div className="w-full space-y-4">
                        <div className="text-left">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">Your Project Vision</label>
                          <textarea 
                            required
                            placeholder="e.g. A high-conversion landing page for a creative agency. Include a project grid, client logos, and a multi-step contact form."
                            rows={6}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-black transition-colors resize-none"
                            value={builderReqs}
                            onChange={e => setBuilderReqs(e.target.value)}
                          />
                        </div>
                        <button 
                          onClick={handleBuildWebsite}
                          disabled={isGenerating || !builderReqs.trim()}
                          className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isGenerating ? <Activity className="animate-spin" size={18} /> : <Zap size={18} />}
                          Architect Full Draft
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {activeTab === 'chatbot' && (
              <div className="p-6 border-t border-gray-100 flex gap-4">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                  placeholder="Ask EngageFlow..."
                  className="flex-1 px-5 py-3 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
                <button 
                  onClick={handleChat}
                  disabled={isGenerating}
                  className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  <ArrowRight size={20} />
                </button>
              </div>
            )}
            {(activeTab === 'website' && websiteSample) && (
               <div className="p-6 border-t border-gray-100 flex justify-end">
                 <button 
                  onClick={() => setWebsiteSample(null)}
                  className="text-gray-500 text-sm font-medium hover:text-black cursor-pointer"
                 >
                   Regenerate Another
                 </button>
               </div>
            )}
            {activeTab === 'automations' && (
              <div className="p-6 border-t border-gray-100 text-center">
                 <p className="text-xs text-gray-400 italic">This flow was auto-generated for "E-commerce Logistics"</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

const Blog = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<any>(null);

  useEffect(() => {
    const q = query(collection(db, 'blogPosts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const p = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(p);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'blogPosts');
    });
    return () => unsubscribe();
  }, []);

  return (
    <section id="blog" className="py-24 px-6 bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-16">
          <div>
            <h2 className="text-4xl font-sans font-bold tracking-tight mb-4">Latest Insights</h2>
            <p className="text-gray-600">Tips and strategies for growth automation.</p>
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-20"><Activity className="animate-spin text-gray-200" size={40} /></div>
        ) : (
          <div className="grid md:grid-cols-3 gap-12">
            {posts.length > 0 ? posts.map((post: any) => (
              <motion.article 
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                onClick={() => setSelectedPost(post)}
                className="group cursor-pointer bg-gray-50 p-8 rounded-[2.5rem] border border-gray-100 hover:border-gray-200 hover:shadow-xl hover:shadow-gray-100 transition-all"
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-3 py-1 bg-white/90 backdrop-blur rounded-full text-[10px] font-bold uppercase tracking-widest text-black border border-gray-100">
                    {post.tag}
                  </span>
                </div>
                <h3 className="text-2xl font-bold mb-3 group-hover:text-black/60 transition-colors uppercase tracking-tight">{post.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-8 line-clamp-3">{post.excerpt}</p>
                <div className="flex items-center gap-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    {post.date}
                  </div>
                </div>
              </motion.article>
            )) : (
              <div className="col-span-3 text-center py-20 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
                <MessageSquare className="mx-auto mb-4 text-gray-300" size={40} />
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No posts yet. Check back soon!</p>
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedPost && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
            onClick={() => setSelectedPost(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-4xl max-h-[85vh] rounded-[3rem] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-4">
                  <span className="px-3 py-1 bg-black text-[10px] text-white font-bold uppercase tracking-widest rounded-full">{selectedPost.tag}</span>
                  <span className="text-xs text-gray-400 font-medium">{selectedPost.date}</span>
                </div>
                <button onClick={() => setSelectedPost(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><Activity size={20} className="rotate-45" /></button>
              </div>
              <div className="p-10 md:p-16 overflow-y-auto custom-scrollbar">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8 leading-tight">{selectedPost.title}</h2>
                <div className="markdown-body prose prose-indigo max-w-none prose-p:text-gray-600 prose-headings:font-bold prose-headings:tracking-tight">
                  <ReactMarkdown>{selectedPost.content || selectedPost.excerpt}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

const Pricing = () => {
  const plans = [
    {
      name: "Starter",
      price: "$29",
      desc: "For small businesses testing the waters.",
      features: ["1 Smart Chatbot Agent", "5 Website Samples / mo", "Standard Speed", "Community Support"],
      button: "Get Started",
      highlight: false
    },
    {
      name: "Professional",
      price: "$79",
      desc: "Ideal for growing service providers.",
      features: ["Unlimited Chatbots", "Priority Requirement Builder", "Full Branding Access", "Analytics Dashboard", "Direct Support"],
      button: "Join Now",
      highlight: true
    },
    {
      name: "Enterprise",
      price: "Custom",
      desc: "Bespoke automation for large scales.",
      features: ["Custom AI Training", "Whitelabel Exports", "Dedicated Account Manager", "SLA Support", "REST API Access"],
      button: "Contact Sales",
      highlight: false
    }
  ];

  return (
    <section id="pricing" className="py-24 px-6 bg-white overflow-hidden border-t border-gray-100">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-sans font-bold tracking-tight mb-4">Investment for Growth</h2>
          <p className="text-gray-500 max-w-xl mx-auto">Transparent pricing to scale your business automation without the complexity.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div 
              key={plan.name}
              className={`p-10 rounded-[2.5rem] border transition-all ${plan.highlight ? 'border-black bg-white shadow-2xl shadow-gray-100 relative scale-105 z-10' : 'border-gray-100 bg-gray-50'}`}
            >
              {plan.highlight && (
                <div className="absolute top-0 right-10 -translate-y-1/2 bg-black text-white px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                  Most Popular
                </div>
              )}
              <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold">{plan.price}</span>
                {plan.price !== 'Custom' && <span className="text-gray-400 text-sm">/mo</span>}
              </div>
              <p className="text-gray-500 text-sm mb-8">{plan.desc}</p>
              <hr className="border-gray-200 mb-8" />
              <ul className="space-y-4 mb-10">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm font-medium text-gray-700">
                    <Zap size={14} className="text-black" />
                    {f}
                  </li>
                ))}
              </ul>
              <button className={`w-full py-4 rounded-2xl font-bold transition-all ${plan.highlight ? 'bg-black text-white hover:bg-gray-800 shadow-xl shadow-black/20' : 'bg-white border border-gray-200 hover:border-black'}`}>
                {plan.button}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Contact = () => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      await addDoc(collection(db, 'contacts'), {
        ...formData,
        status: 'new',
        createdAt: serverTimestamp(),
      });
      setStatus('success');
      setFormData({ name: '', email: '', message: '' });
      setTimeout(() => setStatus('idle'), 5000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'contacts');
      setStatus('error');
    }
  };

  return (
    <section id="contact" className="py-24 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl font-sans font-bold tracking-tight mb-6">Let's talk about <br /> your business.</h2>
            <p className="text-gray-600 mb-10 leading-relaxed max-w-md">
              Ready to integrate AI into your workflow? Reach out to our founder directly for a personalized consultation.
            </p>
            
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <Bot size={20} className="text-black" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Founding Partner</p>
                  <p className="font-bold">Aditya</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <MessageSquare size={20} className="text-black" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Email Address</p>
                  <a href="mailto:aditya@engageflow.com" className="font-bold hover:text-indigo-600 transition-colors">aditya@engageflow.com</a>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-8 md:p-12 rounded-[2.5rem] border border-gray-100 shadow-sm">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-5 py-4 bg-white border border-gray-100 rounded-2xl focus:outline-none focus:border-black transition-colors" 
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Work Email</label>
                  <input 
                    required
                    type="email" 
                    className="w-full px-5 py-4 bg-white border border-gray-100 rounded-2xl focus:outline-none focus:border-black transition-colors" 
                    placeholder="john@company.com"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Message</label>
                <textarea 
                  required
                  rows={4} 
                  className="w-full px-5 py-4 bg-white border border-gray-100 rounded-2xl focus:outline-none focus:border-black transition-colors resize-none" 
                  placeholder="Tell us about your automation needs..." 
                  value={formData.message}
                  onChange={e => setFormData({...formData, message: e.target.value})}
                />
              </div>
              <button 
                disabled={status === 'loading'}
                className="w-full bg-black text-white py-5 rounded-2xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
              >
                {status === 'loading' ? <Activity className="animate-spin" /> : status === 'success' ? 'Message Sent!' : 'Send Message'} 
                {status !== 'loading' && status !== 'success' && <ArrowRight size={18} />}
              </button>
              {status === 'error' && <p className="text-red-500 text-xs font-bold text-center">Failed to send. Please try again.</p>}
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

const Footer = () => (
  <footer className="py-12 border-t border-gray-100 px-6">
    <div className="max-w-7xl mx-auto flex flex-col md:row justify-between items-center gap-8">
      <div className="flex items-center gap-2">
        <Zap size={20} className="text-black" />
        <span className="font-sans font-bold">EngageFlow AI</span>
      </div>
      <div className="flex gap-8 text-sm text-gray-400">
        <a href="#" className="hover:text-black">Terms</a>
        <a href="#" className="hover:text-black">Privacy</a>
        <a href="#" className="hover:text-black">Contact</a>
      </div>
      <p className="text-sm text-gray-400">© 2026 EngageFlow AI. Built with precision.</p>
    </div>
  </footer>
);

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'posts' | 'messages'>('users');
  const [posts, setPosts] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  
  const [newPost, setNewPost] = useState({ title: '', excerpt: '', content: '', tag: 'Growth' });
  const [isPublishing, setIsPublishing] = useState(false);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [aiTopic, setAiTopic] = useState('');

  useEffect(() => {
    const qPosts = query(collection(db, 'blogPosts'), orderBy('createdAt', 'desc'));
    const unsubPosts = onSnapshot(qPosts, (sn) => {
      setPosts(sn.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'blogPosts'));
    
    const qMsgs = query(collection(db, 'contacts'), orderBy('createdAt', 'desc'));
    const unsubMsgs = onSnapshot(qMsgs, (sn) => {
      setMessages(sn.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'contacts'));

    return () => { unsubPosts(); unsubMsgs(); };
  }, []);

  const handleCreatePost = async () => {
    if (!newPost.title || !newPost.excerpt) return;
    setIsPublishing(true);
    try {
      await addDoc(collection(db, 'blogPosts'), {
        ...newPost,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        authorId: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
      });
      setNewPost({ title: '', excerpt: '', content: '', tag: 'Growth' });
    } catch (e) { 
      handleFirestoreError(e, OperationType.CREATE, 'blogPosts');
      console.error(e); 
    }
    finally { setIsPublishing(false); }
  };

  const handleAIGenerate = async () => {
    if (!aiTopic) return;
    setIsAIGenerating(true);
    try {
      const generated = await generateBlogContent(aiTopic);
      setNewPost({
        title: generated.title,
        excerpt: generated.excerpt,
        content: generated.content,
        tag: generated.tag
      });
    } catch (error) {
      console.error("AI Generation failed:", error);
    } finally {
      setIsAIGenerating(false);
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!window.confirm("Delete this post?")) return;
    try {
      await deleteDoc(doc(db, 'blogPosts', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `blogPosts/${id}`);
    }
  };

  return (
    <section id="admin-panel" className="py-24 px-6 bg-[#0A0A0A] text-white min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-16 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
              <h2 className="text-4xl font-bold tracking-tight">Admin Operations</h2>
            </div>
            <p className="text-white/40">Master command center for platform data and content.</p>
          </div>
          
          <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-xl">
            {(['users', 'posts', 'messages'] as const).map(t => (
              <button 
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === t ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40' : 'text-white/40 hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'posts' && (
          <div className="grid lg:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div className="bg-indigo-600/10 p-8 rounded-[2rem] border border-indigo-500/20">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Zap size={18} /> AI Content Engine</h3>
                <div className="flex gap-3">
                  <input 
                    placeholder="Enter topic (e.g. SEO tips for 2026)"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500"
                    value={aiTopic}
                    onChange={e => setAiTopic(e.target.value)}
                  />
                  <button 
                    onClick={handleAIGenerate}
                    disabled={isAIGenerating || !aiTopic}
                    className="bg-indigo-600 hover:bg-indigo-500 px-6 rounded-xl text-xs font-bold uppercase transition-all disabled:opacity-50"
                  >
                    {isAIGenerating ? <Activity className="animate-spin" size={16} /> : 'Generate'}
                  </button>
                </div>
              </div>

              <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10">
                <h3 className="text-xl font-bold mb-8">Publish New Post</h3>
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">Post Title</label>
                    <input 
                      className="w-full bg-transparent border-b border-white/10 py-3 focus:border-indigo-500 outline-none"
                      value={newPost.title}
                      onChange={e => setNewPost({...newPost, title: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">Excerpt</label>
                    <textarea 
                      className="w-full bg-transparent border border-white/10 rounded-xl p-4 focus:border-indigo-500 outline-none resize-none"
                      rows={2}
                      value={newPost.excerpt}
                      onChange={e => setNewPost({...newPost, excerpt: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">Full Content (Markdown)</label>
                    <textarea 
                      className="w-full bg-transparent border border-white/10 rounded-xl p-4 focus:border-indigo-500 outline-none resize-none font-mono text-sm"
                      rows={8}
                      placeholder="Post content..."
                      value={newPost.content}
                      onChange={e => setNewPost({...newPost, content: e.target.value})}
                    />
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {['Growth', 'AI', 'SEO', 'Tips', 'Case Study'].map(t => (
                      <button 
                        key={t}
                        onClick={() => setNewPost({...newPost, tag: t})}
                        className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase border transition-all ${newPost.tag === t ? 'bg-indigo-600 border-indigo-600' : 'border-white/10 hover:border-white/40'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <button 
                    onClick={handleCreatePost}
                    disabled={isPublishing || !newPost.title}
                    className="w-full bg-white text-black py-4 rounded-2xl font-bold hover:bg-indigo-500 hover:text-white transition-all disabled:opacity-50"
                  >
                    {isPublishing ? <Activity className="animate-spin mx-auto" /> : 'Publish to Feed'}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4 max-h-[800px] overflow-y-auto pr-4 custom-scrollbar">
              <h3 className="text-xl font-bold mb-4">Post Management</h3>
              {posts.map(p => (
                <div key={p.id} className="p-6 bg-white/5 border border-white/10 rounded-2xl flex justify-between items-center group">
                  <div>
                    <p className="font-bold mb-1">{p.title}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-white/20 uppercase tracking-widest font-bold">{p.date}</span>
                      <span className="px-2 py-0.5 bg-white/10 rounded text-[8px] font-bold uppercase">{p.tag}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeletePost(p.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition-all p-2"
                    title="Delete Post"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold mb-8">Inbound Inquiries</h3>
            <div className="grid md:grid-cols-2 gap-6">
              {messages.map(m => (
                <div key={m.id} className="p-8 bg-white/5 border border-white/10 rounded-[2.5rem]">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="font-bold text-lg">{m.name}</p>
                      <p className="text-indigo-400 text-xs italic">{m.email}</p>
                    </div>
                    <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase">{m.status}</span>
                  </div>
                  <p className="text-white/60 mb-6 italic">"{m.message}"</p>
                  <p className="text-[10px] text-white/20 tracking-widest uppercase font-bold">{m.createdAt?.toDate().toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white/5 rounded-[3rem] border border-white/10 overflow-hidden">
            <div className="bg-white/5 px-10 py-6 border-b border-white/10">
              <span className="text-[10px] text-emerald-500/80 font-bold uppercase tracking-widest">Active Users System</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                    <th className="p-8">Account Details</th>
                    <th className="p-8">Permissions</th>
                    <th className="p-8 text-right">Registered</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-medium">
                  <tr className="border-t border-white/5 group">
                    <td className="p-8">
                      <p className="text-white">System Admin</p>
                      <p className="text-indigo-400 text-xs">adityakumar16290@gmail.com</p>
                    </td>
                    <td className="p-8"><span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded text-[10px] font-bold uppercase">Root</span></td>
                    <td className="p-8 text-white/40 text-right text-xs">May 1, 2026</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    // Open auth modal automatically if reset code is present
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'resetPassword' && params.get('oobCode')) {
      setIsAuthOpen(true);
    }
  }, []);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let role = 'user';
        let bio = '';
        
        try {
          // Fetch additional user data from Firestore
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const data = userSnap.data();
            role = data.role || 'user';
            bio = data.bio || '';
            
            // Force role to admin if email matches, even if Firestore is outdated
            if (firebaseUser.email === 'adityakumar16290@gmail.com' && role !== 'admin') {
              role = 'admin';
              await setDoc(userRef, { ...data, role: 'admin' }, { merge: true });
            }
          } else {
            // Initialize user in Firestore if not exists
            const isTargetAdmin = firebaseUser.email === 'adityakumar16290@gmail.com';
            await setDoc(userRef, {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
              photoURL: firebaseUser.photoURL || '',
              role: isTargetAdmin ? 'admin' : 'user',
              bio: '',
              theme: 'light',
              createdAt: serverTimestamp(),
            });
            role = isTargetAdmin ? 'admin' : 'user';
          }
        } catch (err: any) {
          // If it's a permission error during initial load, we still want to let the user in
          // but maybe they won't have their role/bio yet.
          console.error("User initialization error:", err);
          
          const isPermissionError = err.code === 'permission-denied' || 
                                  err.message?.toLowerCase().includes('permission') ||
                                  err.message?.toLowerCase().includes('insufficient');
          
          if (!isPermissionError) {
             handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
          }
        }

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
          photo: firebaseUser.photoURL,
          role,
          bio,
        });
      } else {
        setUser(null);
      }
      setIsReady(true);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Activity className="animate-spin text-black" size={40} />
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white">
      <Navbar onOpenAuth={() => setIsAuthOpen(true)} onOpenSettings={() => setIsSettingsOpen(true)} user={user} onLogout={handleLogout} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} user={user} />
      
      <main>
        <Hero onOpenAuth={() => setIsAuthOpen(true)} />
        <Features />
        
        {user ? (
          <>
            <AIDemo />
          </>
        ) : (
          <section id="demo" className="py-24 px-6 bg-gray-50 border-y border-gray-100">
            <div className="max-w-4xl mx-auto text-center">
              <div className="w-16 h-16 bg-white border border-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-sm">
                <Bot size={32} className="text-gray-400" />
              </div>
              <h2 className="text-4xl font-bold tracking-tight mb-4">Unlock Professional Tools</h2>
              <p className="text-gray-500 mb-10 max-w-lg mx-auto leading-relaxed">
                Our AI Chatbot builder and Website Generator are available to registered partners. Join 2,000+ businesses automating their growth today.
              </p>
              <button 
                onClick={() => setIsAuthOpen(true)}
                className="bg-black text-white px-8 py-4 rounded-full font-bold hover:bg-gray-800 transition-all shadow-xl shadow-gray-200 flex items-center gap-2 mx-auto"
              >
                Sign In to Access Tools <ArrowRight size={18} />
              </button>
            </div>
          </section>
        )}

        <GrowthCalculator />
        <Blog />
        <Pricing />
        <Contact />
        {isAdmin && <AdminPanel />}
        <section className="py-24 px-6 bg-black text-white text-center overflow-hidden relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full opacity-20 pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-indigo-500/20" />
          </div>
          <div className="max-w-4xl mx-auto relative z-10">
            <h2 className="text-5xl md:text-6xl font-bold tracking-tight mb-8">Ready to transform your service?</h2>
            <p className="text-white/60 text-lg mb-12 max-w-xl mx-auto">Join the new era of business automation with EngageFlow AI.</p>
            <button 
              onClick={() => !user && setIsAuthOpen(true)}
              className="bg-white text-black px-10 py-5 rounded-full font-bold text-lg hover:bg-gray-200 transition-all shadow-2xl shadow-white/10"
            >
              {user ? 'Go to Dashboard' : 'Launch Your AI Agent'}
            </button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
