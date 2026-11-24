import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { LogIn, UserPlus, AlertCircle, Sparkles, Eye, EyeOff, X } from 'lucide-react';

interface AuthScreenProps {
  onAuthSuccess: (token: string, user: { id: string; username: string; displayName: string; email?: string; isPremium?: boolean; premiumPlan?: 'monthly' | 'yearly' | null }) => void;
  onClose?: () => void;
  initialIsRegistering?: boolean;
}

export default function AuthScreen({ onAuthSuccess, onClose, initialIsRegistering = false }: AuthScreenProps) {
  const [isRegistering, setIsRegistering] = useState(initialIsRegistering);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Sync state if initialIsRegistering changes
  useEffect(() => {
    setIsRegistering(initialIsRegistering);
  }, [initialIsRegistering]);

  // Password rules validation
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasDigit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isRegistering && !isPasswordValid) {
      setError("Le mot de passe ne respecte pas les critères de sécurité requis.");
      return;
    }

    setLoading(true);

    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
    const body = isRegistering 
      ? { username, password, displayName: username, email } 
      : { username, password };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Une erreur est survenue");
      }

      // Save to localStorage
      localStorage.setItem('tiger_task_token', data.token);
      localStorage.setItem('tiger_task_user', JSON.stringify(data.user));
      
      onAuthSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white relative overflow-hidden px-4">
      {/* Background ambient glowing orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-violet-600/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-600/10 blur-[130px] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md glass-panel p-8 rounded-3xl relative z-10"
        id="auth-card"
      >
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        )}
        {/* Header / Logo */}
        <div className="flex flex-col items-center mb-8 text-center" id="auth-logo">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-emerald-400 p-[1px] shadow-lg mb-4 flex items-center justify-center">
            <div className="w-full h-full rounded-2xl bg-slate-950 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-violet-400 animate-pulse" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-violet-200 via-indigo-100 to-emerald-300">
            Tiger Task
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-[280px]">
            L'organisation du temps inspirée de Fibre Tigre
          </p>
        </div>

        {/* Error alert */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3"
            id="auth-error"
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-5" id="auth-form">
          {isRegistering && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Adresse Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ex. fibretigre@gmail.com"
                className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/70 transition-all text-sm"
                id="email-input"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Nom d'utilisateur
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ex. fibretigre"
              className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/70 transition-all text-sm"
              id="username-input"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Mot de passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-4 pr-11 py-3 rounded-xl bg-slate-900/60 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/70 transition-all text-sm"
                id="password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>

            {/* Password security rules display */}
            {isRegistering && (
              <div className="mt-3 p-3 bg-slate-900/80 border border-slate-800/80 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Règles de sécurité requises :
                  </span>
                  {password.length > 0 && (
                    <span className={`text-[10px] font-semibold ${isPasswordValid ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {isPasswordValid ? 'Sécurisé' : 'Faible'}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${hasMinLength ? 'bg-emerald-500 shadow-sm shadow-emerald-500' : 'bg-slate-700'}`} />
                    <span className={`transition-colors duration-300 ${hasMinLength ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>8+ caractères</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${hasUppercase ? 'bg-emerald-500 shadow-sm shadow-emerald-500' : 'bg-slate-700'}`} />
                    <span className={`transition-colors duration-300 ${hasUppercase ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>1 majuscule</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${hasLowercase ? 'bg-emerald-500 shadow-sm shadow-emerald-500' : 'bg-slate-700'}`} />
                    <span className={`transition-colors duration-300 ${hasLowercase ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>1 minuscule</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${hasDigit ? 'bg-emerald-500 shadow-sm shadow-emerald-500' : 'bg-slate-700'}`} />
                    <span className={`transition-colors duration-300 ${hasDigit ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>1 chiffre</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 font-medium text-white transition-all shadow-lg hover:shadow-violet-500/20 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 text-sm cursor-pointer"
            id="auth-submit-btn"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isRegistering ? (
              <>
                <UserPlus className="w-4 h-4" />
                Créer mon compte
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Se connecter
              </>
            )}
          </button>
        </form>

        {/* Toggle sign in / register */}
        <div className="mt-8 text-center text-sm border-t border-slate-800/80 pt-6" id="auth-toggle">
          <span className="text-slate-400">
            {isRegistering ? "Vous avez déjà un compte ?" : "Nouveau sur Tiger Task ?"}
          </span>{' '}
          <button
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError(null);
            }}
            className="text-violet-400 hover:text-violet-300 font-semibold transition-colors focus:outline-none ml-1 cursor-pointer"
            id="auth-toggle-btn"
          >
            {isRegistering ? "Connectez-vous" : "Créez un compte gratuitement"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
