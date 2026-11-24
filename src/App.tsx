import React, { useState, useEffect } from 'react';
import { Task, User, Stats, STATUS_CONFIGS, TaskStatus } from './types';
import AuthScreen from './components/AuthScreen';
import LandingPage from './components/LandingPage';
import PaymentScreen from './components/PaymentScreen';
import DevEmailInbox from './components/DevEmailInbox';
import DayBlock from './components/DayBlock';
import StatsBento from './components/StatsBento';
import { 
  LogOut, 
  Search, 
  Sparkles, 
  TrendingUp, 
  RotateCcw,
  User as UserIcon,
  CalendarCheck,
  X,
  Trash2,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function getCurrentWeekStrings(): string[] {
  const dates: string[] = [];
  const today = new Date();
  const day = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const diffToMonday = today.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(today);
  monday.setDate(diffToMonday);
  
  for (let i = 0; i < 7; i++) {
    const current = new Date(monday);
    current.setDate(monday.getDate() + i);
    dates.push(current.toISOString().split('T')[0]);
  }
  return dates;
}

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Auth Modal details
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authInitialRegister, setAuthInitialRegister] = useState(false);

  // Email Activation States
  const [activationEmail, setActivationEmail] = useState<string | null>(null);
  const [isActivationSuccess, setIsActivationSuccess] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  
  // App navigation & filters
  const [activeTab, setActiveTab] = useState<'schedule' | 'stats'>('schedule');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [isScrolled, setIsScrolled] = useState(false);

  // Parse verification success query parameters on initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const email = params.get('email');
    if (action === 'activate-success') {
      setIsActivationSuccess(true);
      if (email) {
        setActivationEmail(email);
      }
      
      // Refresh logged-in user state immediately if verified
      const savedToken = localStorage.getItem('tiger_task_token');
      if (savedToken) {
        fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${savedToken}` }
        })
        .then(res => {
          if (res.ok) return res.json();
        })
        .then(data => {
          if (data && data.user) {
            setUser(data.user);
            localStorage.setItem('tiger_task_user', JSON.stringify(data.user));
          }
        })
        .catch(err => console.error("Error refreshing verified profile:", err));
      }

      // Clear search query parameters cleanly from address bar
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Scroll listener to toggle compact header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Interactive Highlighting Row Date State
  const [highlightedDate, setHighlightedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Rich Task Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalDate, setModalDate] = useState('');
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Modal Form States
  const [modalText, setModalText] = useState('');
  const [modalDescription, setModalDescription] = useState('');
  const [modalPriority, setModalPriority] = useState(5);
  const [modalStatus, setModalStatus] = useState<TaskStatus>('white');

  // Auth bootstrap
  useEffect(() => {
    const savedToken = localStorage.getItem('tiger_task_token');
    const savedUser = localStorage.getItem('tiger_task_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      fetchData(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  // Auto-scroll to the current week/day for free users on initial load
  useEffect(() => {
    if (!loading && token && user && user.premiumPlan === 'free' && activeTab === 'schedule') {
      const todayStr = new Date().toISOString().split('T')[0];
      const timer = setTimeout(() => {
        const element = document.getElementById(`day-block-${todayStr}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [loading, token, user, activeTab]);

  const fetchData = async (authToken: string) => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${authToken}` };
      
      // Sync user profile dynamically to catch backend changes (e.g. premium, verified status)
      const userRes = await fetch('/api/auth/me', { headers });
      if (userRes.ok) {
        const userData = await userRes.json();
        if (userData && userData.user) {
          setUser(userData.user);
          localStorage.setItem('tiger_task_user', JSON.stringify(userData.user));
        }
      } else if (userRes.status === 401 || userRes.status === 403) {
        handleLogout();
        return;
      }

      const tasksRes = await fetch('/api/tasks', { headers });
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData);
      } else if (tasksRes.status === 401 || tasksRes.status === 403) {
        handleLogout();
        return;
      }

      const statsRes = await fetch('/api/stats', { headers });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error("Error fetching tasks, profile or stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    fetchData(newToken);
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (err) {
        console.error("Logout request failed:", err);
      }
    }
    localStorage.removeItem('tiger_task_token');
    localStorage.removeItem('tiger_task_user');
    setToken(null);
    setUser(null);
    setTasks([]);
    setStats(null);
    setLoading(false);
  };

  /* ==========================================================================
     CRUD OPERATIONS FOR TASKS
     ========================================================================== */

  const handleAddTask = async (
    date: string, 
    text: string, 
    priority: number, 
    description: string = '', 
    status: TaskStatus = 'white'
  ) => {
    if (!token) return;
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ date, text, priority, status, description })
      });

      if (res.ok) {
        await fetchData(token);
      }
    } catch (err) {
      console.error("Error adding task:", err);
    }
  };

  const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(updates)
      });

      if (res.ok) {
        // Optimistically update locally first, then refresh stats
        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
        
        // Fetch fresh stats to update the indices
        const statsRes = await fetch('/api/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }
      }
    } catch (err) {
      console.error("Error updating task:", err);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setTasks(prev => prev.filter(t => t.id !== id));
        
        // Update stats
        const statsRes = await fetch('/api/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }
      }
    } catch (err) {
      console.error("Error deleting task:", err);
    }
  };

  const handlePostponeTask = async (id: string, reason: 'flemme' | 'volonte') => {
    if (!token) return;
    try {
      const res = await fetch(`/api/tasks/${id}/postpone`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ reason })
      });

      if (res.ok) {
        await fetchData(token);
      }
    } catch (err) {
      console.error("Error postponing task:", err);
    }
  };

  // Generate a list of all days in the selected year
  const getDaysForYear = (year: number) => {
    const list = [];
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    let current = new Date(start);
    while (current <= end) {
      list.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return list;
  };

  // Scroll directly to Today or first day of the year on load / selection
  useEffect(() => {
    if (!loading && token) {
      const timer = setTimeout(() => {
        const today = new Date();
        const currentYear = today.getFullYear();
        if (selectedYear === currentYear) {
          const todayStr = today.toISOString().split('T')[0];
          const element = document.getElementById(`day-block-${todayStr}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else {
          const firstDayStr = `${selectedYear}-01-01`;
          const element = document.getElementById(`day-block-${firstDayStr}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [selectedYear, loading, token]);

  /* ==========================================================================
     MODAL TRIGGERS
     ========================================================================== */

  const openAddTaskModal = (date: string) => {
    setModalMode('create');
    setModalDate(date);
    setModalText('');
    setModalDescription('');
    setModalPriority(5);
    setModalStatus('white');
    setIsModalOpen(true);
  };

  const openEditTaskModal = (task: Task) => {
    setModalMode('edit');
    setEditingTask(task);
    setModalDate(task.date);
    setModalText(task.text);
    setModalDescription(task.description || '');
    setModalPriority(task.priority);
    setModalStatus(task.status);
    setIsModalOpen(true);
  };

  const handleResendEmail = async () => {
    if (!token) return;
    setResendStatus('sending');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setResendStatus('success');
        setTimeout(() => setResendStatus('idle'), 5000);
      } else {
        setResendStatus('error');
      }
    } catch (err) {
      setResendStatus('error');
    }
  };

  if (isActivationSuccess) {
    return (
      <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-center items-center py-12 px-4 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-[-20%] left-[-20%] w-[1000px] h-[1000px] rounded-full bg-emerald-500/5 blur-[180px] pointer-events-none" />
        
        <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md text-center space-y-6 relative z-10 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
            <Sparkles className="w-8 h-8 text-emerald-400 animate-bounce" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-200">
              Compte Activé ! 🐅
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Félicitations, l'activation de votre compte gratuit ou Premium a été validée avec succès.
            </p>
          </div>

          {activationEmail && (
            <div className="p-3 py-2 rounded-lg bg-white/5 border border-white/5 text-[11px] text-slate-300 font-mono inline-block">
              {activationEmail}
            </div>
          )}

          <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/50 text-xs text-slate-300 leading-relaxed text-left space-y-2">
            <p>✅ <strong>Adresse e-mail vérifiée :</strong> Votre compte est maintenant pleinement opérationnel.</p>
            <p>✅ <strong>Accès aux fonctionnalités :</strong> Utilisez le système de gestion de tâches par indice de volonté en toute fluidité.</p>
          </div>

          <button
            onClick={() => {
              setIsActivationSuccess(false);
              if (!token) {
                setAuthInitialRegister(false);
                setShowAuthModal(true);
              }
            }}
            className="w-full py-3.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 hover:opacity-95 shadow-lg shadow-emerald-500/10 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>{token ? "Accéder à mon tableau de bord 🚀" : "Me connecter à mon compte"}</span>
          </button>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <>
        <LandingPage
          onLoginClick={() => {
            setAuthInitialRegister(false);
            setShowAuthModal(true);
          }}
          onRegisterClick={(plan) => {
            setAuthInitialRegister(true);
            setShowAuthModal(true);
          }}
        />
        <DevEmailInbox />
        <AnimatePresence>
          {showAuthModal && (
            <div className="fixed inset-0 z-50">
              <AuthScreen
                onAuthSuccess={(newToken, newUser) => {
                  handleAuthSuccess(newToken, newUser);
                  setShowAuthModal(false);
                }}
                onClose={() => setShowAuthModal(false)}
                initialIsRegistering={authInitialRegister}
              />
            </div>
          )}
        </AnimatePresence>
      </>
    );
  }

  if (user && !user.isPremium && !user.premiumPlan) {
    return (
      <>
        <PaymentScreen
          token={token}
          user={user}
          onSubscriptionSuccess={(updatedUser) => {
            setUser(updatedUser);
            localStorage.setItem('tiger_task_user', JSON.stringify(updatedUser));
          }}
          onLogout={handleLogout}
        />
        <DevEmailInbox />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans relative pb-24 selection:bg-violet-600/40 selection:text-white overflow-x-clip">
      {/* 0. Activation Alert Banner */}
      {user && user.premiumPlan === 'free' && !user.isVerified && !isBannerDismissed && (
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-b border-amber-500/20 py-2.5 px-4 text-center text-xs text-amber-200 relative z-50 backdrop-blur-sm flex flex-col sm:flex-row items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <span className="animate-pulse">🐅</span>
            <span>
              <strong>Activation requise :</strong> Veuillez confirmer l'activation de votre compte gratuit en cliquant sur le lien reçu par email à l'adresse <strong>{user.email}</strong>.
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleResendEmail}
              disabled={resendStatus === 'sending'}
              className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 disabled:opacity-50 text-[10px] transition-all cursor-pointer shadow"
            >
              {resendStatus === 'idle' && "Renvoyer l'email"}
              {resendStatus === 'sending' && "Envoi..."}
              {resendStatus === 'success' && "Email envoyé ! Checkez vos spams"}
              {resendStatus === 'error' && "Erreur lors de l'envoi"}
            </button>
            <button
              onClick={() => setIsBannerDismissed(true)}
              className="text-amber-400/60 hover:text-amber-200 transition-colors cursor-pointer p-0.5"
              title="Masquer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Background ambient decorative glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] rounded-full bg-violet-600/5 blur-[150px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-500/5 blur-[150px] pointer-events-none" />
      
      {/* 1. Global Navigation Bar */}
      <header className={`border-b border-white/5 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40 px-4 md:px-6 transition-all duration-300 ${
        isScrolled ? 'py-1.5 shadow-xl shadow-black/40 border-white/10' : 'py-3'
      }`}>
        {isScrolled ? (
          /* --- COMPACT SCROLLED HEADER --- */
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3 animate-fade-in">
            {/* Left: Logo & Tabs & Years */}
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-0.5">
              {/* Logo */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-7.5 h-7.5 rounded-lg bg-gradient-to-tr from-violet-600 to-emerald-400 p-[1px] flex items-center justify-center">
                  <div className="w-full h-full rounded-lg bg-slate-950 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                </div>
                <span className="text-sm font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-violet-200 to-emerald-300 font-sans hidden sm:inline">
                  Tiger Task
                </span>
              </div>

              {/* Nav Tabs */}
              <div className="flex items-center bg-white/5 p-0.5 rounded-lg border border-white/5 shrink-0">
                <button
                  onClick={() => setActiveTab('schedule')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide transition-all flex items-center gap-1 cursor-pointer ${
                    activeTab === 'schedule' 
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CalendarCheck className="w-3 h-3" />
                  <span>Planification</span>
                </button>
                <button
                  onClick={() => setActiveTab('stats')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide transition-all flex items-center gap-1 cursor-pointer ${
                    activeTab === 'stats' 
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <TrendingUp className="w-3 h-3" />
                  <span>Analyses</span>
                </button>
              </div>

              {/* Years */}
              <div className="flex items-center bg-white/5 p-0.5 rounded-lg border border-white/5 shrink-0">
                {[2025, 2026, 2027, 2028].map((yr) => (
                  <button
                    key={yr}
                    onClick={() => setSelectedYear(yr)}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                      selectedYear === yr 
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Search, Filters & Profile */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Search & Filters (only in schedule tab) */}
              {activeTab === 'schedule' && (
                <div className="hidden md:flex items-center gap-2">
                  {/* Search input */}
                  <div className="relative">
                    <Search className="absolute left-2 top-1.5 w-3 h-3 text-slate-500" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Rechercher..."
                      className="w-24 sm:w-32 focus:w-44 transition-all duration-300 pl-7 pr-6 py-0.5 rounded bg-slate-900/60 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/70 text-[11px]"
                    />
                    {searchTerm && (
                      <button 
                        onClick={() => setSearchTerm('')}
                        className="absolute right-1.5 top-1 text-[9px] text-slate-400 hover:text-white font-mono cursor-pointer"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Status mini color circles */}
                  <div className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-lg border border-white/5">
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer ${
                        statusFilter === 'all' 
                          ? 'bg-white/10 text-white' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Tous"
                    >
                      Tous
                    </button>
                    {(Object.keys(STATUS_CONFIGS) as Array<TaskStatus>).map((key) => {
                      const config = STATUS_CONFIGS[key];
                      const qty = tasks.filter(t => t.status === key).length;
                      
                      const colorMap: Record<string, string> = {
                        white: '#ffffff',
                        green: '#10b981',
                        yellow: '#fbbf24',
                        red: '#f43f5e',
                        blue: '#0ea5e9',
                        purple: '#8b5cf6'
                      };
                      
                      return (
                        <button
                          key={key}
                          onClick={() => setStatusFilter(key)}
                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all hover:scale-110 cursor-pointer border ${
                            statusFilter === key ? 'ring-1 ring-violet-500 ring-offset-1 ring-offset-slate-950 scale-105' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: colorMap[key] }}
                          title={`${config.label} (${qty})`}
                        >
                          <span className="text-[7px] font-bold text-slate-950 opacity-90">{qty}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Clear filters button */}
                  {(searchTerm || statusFilter !== 'all') && (
                    <button
                      onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
                      className="p-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                      title="Réinitialiser"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Profile & Logout */}
              <div className="flex items-center gap-1.5">
                <div 
                  className="w-7 h-7 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-400"
                  title={user?.email || "Utilisateur"}
                >
                  <UserIcon className="w-3 h-3" />
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/5 hover:border-rose-500/10 transition-all cursor-pointer"
                  title="Se déconnecter"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* --- FULL ORIGINAL COMFORTABLE HEADER --- */
          <div className="flex flex-col gap-3">
            {/* Row 1: Logo, Nav Tabs, Year, Profile */}
            <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row items-center justify-between gap-4">
              
              {/* Logo brand */}
              <div className="flex items-center gap-2.5 shrink-0" id="app-logo">
                <div className="w-8.5 h-8.5 rounded-lg bg-gradient-to-tr from-violet-600 to-emerald-400 p-[1px] shadow-lg flex items-center justify-center">
                  <div className="w-full h-full rounded-lg bg-slate-950 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                  </div>
                </div>
                <div>
                  <span className="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-violet-200 to-emerald-300 font-sans">
                    Tiger Task
                  </span>
                  <p className="text-[8px] text-slate-500 uppercase tracking-widest leading-none font-mono">Tableau d'Organisation</p>
                </div>
              </div>

              {/* Central Section: Tab Navigation + Year Selector side-by-side */}
              <div className="flex flex-wrap items-center gap-3 justify-center">
                {/* Tab Navigation */}
                <div className="flex items-center bg-white/5 p-0.5 rounded-xl border border-white/5" id="navigation-tabs">
                  <button
                    onClick={() => setActiveTab('schedule')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'schedule' 
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md font-bold' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                    id="tab-schedule-btn"
                  >
                    <CalendarCheck className="w-3.5 h-3.5" />
                    <span>Planification</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('stats')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'stats' 
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md font-bold' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                    id="tab-stats-btn"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Analyses & Stats</span>
                  </button>
                </div>

                {/* Year Selector */}
                <div className="flex items-center bg-white/5 p-0.5 rounded-xl border border-white/5" id="year-tabs-header">
                  {[2025, 2026, 2027, 2028].map((yr) => (
                    <button
                      key={yr}
                      onClick={() => setSelectedYear(yr)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                        selectedYear === yr 
                          ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm font-bold scale-105' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                      id={`year-tab-${yr}`}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
              </div>

              {/* User Profile & Logout */}
              <div className="flex items-center gap-3 shrink-0" id="user-profile-menu">
                <div className="text-right hidden lg:block">
                  <span className="text-[9px] text-slate-500 uppercase font-bold font-mono tracking-wider block leading-none">Compte</span>
                  <span className="text-xs font-semibold text-slate-200 block">{user?.displayName || user?.email?.split('@')[0]}</span>
                </div>
                <div 
                  className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-400"
                  title={user?.email || "Utilisateur"}
                >
                  <UserIcon className="w-3.5 h-3.5" />
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/5 hover:border-rose-500/10 transition-all cursor-pointer"
                  title="Se déconnecter"
                  id="logout-btn"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>

            {/* Row 2: Search & Filters (Only in 'schedule' tab) */}
            {activeTab === 'schedule' && (
              <div className="max-w-7xl mx-auto w-full border-t border-white/5 pt-3 flex flex-col md:flex-row items-center justify-between gap-3" id="filters-bento-card">
                {/* Search bar */}
                <div className="relative w-full md:w-64 shrink-0">
                  <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Rechercher une tâche..."
                    className="w-full pl-8 pr-12 py-1 rounded-lg bg-slate-900/60 border border-slate-800/80 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/70 transition-all text-xs"
                    id="search-input"
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1.5 text-[10px] text-slate-400 hover:text-white font-mono cursor-pointer"
                    >
                      Effacer
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-1 justify-start md:justify-end w-full">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
                      statusFilter === 'all' 
                        ? 'bg-white/10 text-white border-white/20 shadow-sm' 
                        : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-slate-200'
                    }`}
                    id="status-filter-all"
                  >
                    Tous ({tasks.length})
                  </button>
                  
                  {(Object.keys(STATUS_CONFIGS) as Array<TaskStatus>).map((key) => {
                    const config = STATUS_CONFIGS[key];
                    const qty = tasks.filter(t => t.status === key).length;
                    return (
                      <button
                        key={key}
                        onClick={() => setStatusFilter(key)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
                          statusFilter === key 
                            ? `${config.bgClass} ${config.colorClass} ${config.borderClass} shadow-sm` 
                            : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-slate-200'
                        }`}
                        id={`status-filter-${key}`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          key === 'white' ? 'border border-slate-400 bg-transparent' :
                          key === 'green' ? 'bg-emerald-500' :
                          key === 'yellow' ? 'bg-amber-400' :
                          key === 'red' ? 'bg-rose-500' :
                          key === 'blue' ? 'bg-sky-500' :
                          key === 'purple' ? 'bg-violet-500' :
                          'bg-slate-900 border border-slate-700'
                        }`} />
                        <span>{config.label}</span>
                        <span className="opacity-60 text-[9px] font-mono">({qty})</span>
                      </button>
                    );
                  })}

                  {/* Reset Filters icon button */}
                  {(searchTerm || statusFilter !== 'all') && (
                    <button
                      onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
                      className="p-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                      title="Réinitialiser les filtres"
                      id="reset-filters-btn"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </header>

      {/* 2. Main Content Stage */}
      <main className="max-w-7xl mx-auto px-6 mt-8">
        
        {/* Loading Overlay */}
        {loading && tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-12 h-12 border-4 border-violet-600/30 border-t-violet-500 rounded-full animate-spin" />
            <p className="text-slate-400 text-sm font-mono uppercase tracking-widest animate-pulse">Chargement en cours...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            
            {/* Tab: STATISTICS */}
            {activeTab === 'stats' && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                id="stats-tab-content"
              >
                <StatsBento stats={stats} />
              </motion.div>
            )}

            {/* Tab: MAIN PLANNER */}
            {activeTab === 'schedule' && (
              <div className="flex flex-col gap-6" id="schedule-tab-content">
                
                {/* Floating Centering Button */}
                <div className="fixed bottom-6 right-6 z-40">
                  <button
                    onClick={() => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      const element = document.getElementById(`day-block-${todayStr}`);
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }}
                    className="px-4 py-2.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-xl shadow-violet-600/20 flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95"
                    title="Revenir au jour d'aujourd'hui"
                    id="back-to-today-floating-btn"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Aujourd'hui</span>
                  </button>
                </div>

                {/* Main 365 spreadsheet scrolling zone */}
                <div className="flex flex-col gap-2 relative" id="day-blocks-container">
                  {(() => {
                    let lastMonthStr = '';
                    return getDaysForYear(selectedYear).map((dateKey) => {
                      const dayTasks = (tasks.filter(t => t.date === dateKey) || []).filter(task => {
                        const matchesSearch = task.text.toLowerCase().includes(searchTerm.toLowerCase());
                        const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
                        return matchesSearch && matchesStatus;
                      });

                      const dateObj = new Date(dateKey);
                      const currentMonthName = dateObj.toLocaleDateString('fr-FR', { month: 'long' });
                      
                      let monthHeader = null;
                      if (currentMonthName !== lastMonthStr) {
                        lastMonthStr = currentMonthName;
                        const capitalizedMonthName = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);
                        monthHeader = (
                          <div 
                            key={`month-header-${currentMonthName}-${selectedYear}`}
                            className={`sticky z-10 py-2 px-4 mt-6 mb-2 rounded-xl bg-slate-900/90 border border-white/5 backdrop-blur-md flex items-center justify-between shadow-md transition-all duration-300 ${
                              isScrolled 
                                ? 'top-[54px]' 
                                : 'top-[112px] md:top-[124px]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-violet-400" />
                              <span className="text-xs font-extrabold text-white tracking-wider uppercase font-sans">
                                {capitalizedMonthName} {selectedYear}
                              </span>
                            </div>
                            <div className="h-[1px] flex-1 bg-white/5 mx-4" />
                            <div className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">
                              Début de mois
                            </div>
                          </div>
                        );
                      }

                      const currentWeek = getCurrentWeekStrings();
                      const isLocked = user?.premiumPlan === 'free' && !currentWeek.includes(dateKey);

                      return (
                        <React.Fragment key={dateKey}>
                          {monthHeader}
                          <DayBlock
                            dateStr={dateKey}
                            tasks={dayTasks}
                            isHighlighted={highlightedDate === dateKey}
                            onAddTaskClick={openAddTaskModal}
                            onTaskClick={openEditTaskModal}
                            onUpdateTask={handleUpdateTask}
                            onDeleteTask={handleDeleteTask}
                            onPostponeTask={handlePostponeTask}
                            onSelectDay={setHighlightedDate}
                            isLocked={isLocked}
                          />
                        </React.Fragment>
                      );
                    });
                  })()}
                </div>

              </div>
            )}

          </div>
        )}

      </main>

      {/* 3. TASK CREATE & DETAIL / EDIT MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[10000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-5 text-left relative"
              id="task-details-modal"
            >
              {/* Close Button */}
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                id="close-modal-btn"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Modal Header */}
              <div>
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <Sparkles className="w-4.5 h-4.5 text-violet-400" />
                  <span>{modalMode === 'create' ? 'Ajouter une tâche' : 'Détails de la tâche'}</span>
                </h3>
                <p className="text-[10px] text-violet-400 font-mono uppercase tracking-widest mt-1">
                  {new Date(modalDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>

              {/* Form Content */}
              <div className="flex flex-col gap-4">
                
                {/* Task Title (text) */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Titre de la tâche (Visible)</label>
                  <input 
                    type="text"
                    required
                    value={modalText}
                    onChange={(e) => setModalText(e.target.value)}
                    placeholder="ex. Nouveau tableur de pilotage"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/70 transition-all text-xs"
                    id="modal-task-title"
                  />
                </div>

                {/* Task Description (only visible inside modal) */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Description & Détails (Cachés)</label>
                  <textarea 
                    value={modalDescription}
                    onChange={(e) => setModalDescription(e.target.value)}
                    placeholder="Écrivez des notes détaillées, des liens, des listes d'étapes..."
                    rows={4}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/70 transition-all text-xs resize-none"
                    id="modal-task-desc"
                  />
                </div>

                {/* Status Selection Grid */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Statut d'organisation</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.values(STATUS_CONFIGS).map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setModalStatus(item.value)}
                        className={`flex items-center gap-2 p-2 rounded-xl text-left border transition-all text-[11px] cursor-pointer ${
                          modalStatus === item.value 
                            ? `${item.bgClass} ${item.borderClass} ${item.colorClass}`
                            : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:bg-slate-950/80 hover:text-white'
                        }`}
                        id={`modal-status-btn-${item.value}`}
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          item.value === 'white' ? 'border border-slate-400 bg-transparent' :
                          item.value === 'green' ? 'bg-emerald-500' :
                          item.value === 'yellow' ? 'bg-amber-400' :
                          item.value === 'red' ? 'bg-rose-500' :
                          item.value === 'blue' ? 'bg-sky-500' :
                          item.value === 'purple' ? 'bg-violet-500' :
                          'bg-slate-900 border border-slate-700'
                        }`} />
                        <span className="font-semibold truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Priority Selection */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Difficulté subjective (Priorité)</label>
                    <span className="text-xs font-mono font-bold text-violet-400">{modalPriority} / 10</span>
                  </div>
                  <input 
                    type="range"
                    min="1"
                    max="10"
                    value={modalPriority}
                    onChange={(e) => setModalPriority(parseInt(e.target.value))}
                    className="w-full accent-violet-500 cursor-pointer h-1.5 bg-slate-950 rounded-lg appearance-none"
                    id="modal-task-priority"
                  />
                  <div className="flex justify-between text-[8px] text-slate-500 font-mono mt-1">
                    <span>1 (Facile)</span>
                    <span>5 (Modéré)</span>
                    <span>10 (Tranchant)</span>
                  </div>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-2">
                {modalMode === 'edit' ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (editingTask) {
                        await handleDeleteTask(editingTask.id);
                        setIsModalOpen(false);
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    id="modal-delete-btn"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Supprimer</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all text-xs font-bold cursor-pointer"
                    id="modal-cancel-btn"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (modalText.trim() === '') return;
                      if (modalMode === 'create') {
                        await handleAddTask(modalDate, modalText, modalPriority, modalDescription, modalStatus);
                      } else if (editingTask) {
                        await handleUpdateTask(editingTask.id, { 
                          text: modalText, 
                          description: modalDescription, 
                          priority: modalPriority, 
                          status: modalStatus 
                        });
                      }
                      setIsModalOpen(false);
                    }}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-600/25 transition-all text-xs font-bold cursor-pointer"
                    id="modal-submit-btn"
                  >
                    {modalMode === 'create' ? 'Ajouter' : 'Enregistrer'}
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DevEmailInbox />
    </div>
  );
}
