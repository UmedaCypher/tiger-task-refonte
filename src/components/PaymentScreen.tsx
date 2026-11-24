import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, ShieldCheck, Sparkles, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { User } from '../types';

interface PaymentScreenProps {
  token: string;
  user: User;
  onSubscriptionSuccess: (updatedUser: User) => void;
  onLogout: () => void;
}

export default function PaymentScreen({ token, user, onSubscriptionSuccess, onLogout }: PaymentScreenProps) {
  const [plan, setPlan] = useState<'free' | 'monthly' | 'yearly'>('yearly');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardName, setCardName] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [paymentStep, setPaymentStep] = useState<'idle' | 'processing' | '3ds' | 'success'>('idle');

  const handleAutofill = () => {
    setCardNumber('4242 •••• •••• 4242');
    setExpiry('12/28');
    setCvc('123');
    setCardName(user.displayName || user.username);
    setError(null);
  };

  const handlePaymentSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (plan !== 'free' && (!cardNumber || !expiry || !cvc || !cardName)) {
      setError("Veuillez remplir toutes les informations de carte de crédit.");
      return;
    }
    
    setError(null);
    setPaymentStep('processing');

    if (plan === 'free') {
      try {
        const res = await fetch('/api/auth/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ plan })
        });

        if (res.ok) {
          const data = await res.json();
          setPaymentStep('success');
          setTimeout(() => {
            onSubscriptionSuccess(data.user);
          }, 1500);
        } else {
          const data = await res.json();
          setError(data.error || "Une erreur est survenue lors de l'activation.");
          setPaymentStep('idle');
        }
      } catch (err) {
        setError("Impossible de contacter le serveur d'authentification.");
        setPaymentStep('idle');
      }
      return;
    }

    // Simulate standard secure Stripe transaction delays for paid plans
    setTimeout(() => {
      setPaymentStep('3ds');
      
      setTimeout(async () => {
        try {
          const res = await fetch('/api/auth/subscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ plan })
          });

          if (res.ok) {
            const data = await res.json();
            setPaymentStep('success');
            setTimeout(() => {
              onSubscriptionSuccess(data.user);
            }, 1500);
          } else {
            const data = await res.json();
            setError(data.error || "Une erreur est survenue lors de la validation de votre paiement.");
            setPaymentStep('idle');
          }
        } catch (err) {
          setError("Impossible de contacter le serveur de paiement sécurisé.");
          setPaymentStep('idle');
        }
      }, 1500);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-between py-12 px-4 md:px-6 relative overflow-hidden selection:bg-violet-600/40 selection:text-white">
      {/* Background radial glow */}
      <div className="absolute top-[-20%] left-[-20%] w-[1000px] h-[1000px] rounded-full bg-violet-600/5 blur-[180px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[800px] h-[800px] rounded-full bg-emerald-500/5 blur-[180px] pointer-events-none" />

      {/* Header */}
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between mb-8 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-emerald-400 p-[1.5px] flex items-center justify-center">
            <div className="w-full h-full rounded-xl bg-slate-950 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-violet-400" />
            </div>
          </div>
          <span className="text-lg font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">
            Tiger Task
          </span>
        </div>
        <button
          onClick={onLogout}
          className="text-xs font-semibold text-slate-400 hover:text-white transition-colors py-2 px-4 rounded-xl border border-slate-800/80 bg-slate-900/40 cursor-pointer"
        >
          Se déconnecter
        </button>
      </div>

      {/* Main Checkout Container */}
      <div className="max-w-4xl mx-auto w-full grid md:grid-cols-12 gap-8 items-start relative z-10 my-auto">
        
        {/* Left Column: Order Summary & Pricing plans */}
        <div className="md:col-span-5 space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md space-y-5">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400 bg-violet-500/10 px-2.5 py-1 rounded-full border border-violet-500/15">
                Activation Premium
              </span>
              <h2 className="text-xl font-bold mt-3">Finaliser votre accès</h2>
              <p className="text-xs text-slate-400 mt-1">
                Choisissez votre formule d'abonnement pour débloquer votre calendrier d'organisation Fibre Tigre.
              </p>
            </div>

            {/* Plan Selector */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setPlan('free')}
                className={`w-full p-4 rounded-xl text-left border transition-all relative flex items-center justify-between cursor-pointer ${
                  plan === 'free'
                    ? 'border-sky-500 bg-sky-500/5 shadow-md shadow-sky-500/5'
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                }`}
              >
                <div>
                  <p className="text-sm font-bold text-white">Formule Gratuite</p>
                  <p className="text-xs text-slate-400 mt-0.5">Tâches de la semaine en cours uniquement</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-black text-white">0,00 €</p>
                  <p className="text-[10px] text-slate-400">/ toujours</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPlan('monthly')}
                className={`w-full p-4 rounded-xl text-left border transition-all relative flex items-center justify-between cursor-pointer ${
                  plan === 'monthly'
                    ? 'border-violet-500 bg-violet-500/5 shadow-md shadow-violet-500/5'
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                }`}
              >
                <div>
                  <p className="text-sm font-bold text-white">Formule Mensuelle</p>
                  <p className="text-xs text-slate-400 mt-0.5">Facturé chaque mois, sans engagement</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-black text-white">1,00 €</p>
                  <p className="text-[10px] text-slate-400">/ mois</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPlan('yearly')}
                className={`w-full p-4 rounded-xl text-left border transition-all relative flex items-center justify-between cursor-pointer ${
                  plan === 'yearly'
                    ? 'border-violet-500 bg-violet-500/5 shadow-md shadow-violet-500/5'
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                }`}
              >
                <div className="absolute -top-2.5 right-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full tracking-wider uppercase">
                  Économisez 16%
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Formule Annuelle</p>
                  <p className="text-xs text-slate-400 mt-0.5">Un an complet d'organisation optimale</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-black text-emerald-400">10,00 €</p>
                  <p className="text-[10px] text-slate-400">/ an</p>
                </div>
              </button>
            </div>

            {/* Benefits list */}
            <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ce qui est inclus :</p>
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Planning interactif illimité</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Suivi de l'Indice de Flemme & Volonté</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Statistiques Bento et rapports annuels</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Email de confirmation & reçus sécurisés</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Secure Stripe Payment Form */}
        <div className="md:col-span-7">
          <div className="p-6 md:p-8 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md relative overflow-hidden shadow-2xl">
            
            <AnimatePresence mode="wait">
              {paymentStep === 'idle' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-300 text-sm font-semibold">
                      <Lock className="w-4 h-4 text-emerald-400" />
                      <span>{plan === 'free' ? "Activation gratuite instantanée" : "Paiement sécurisé crypté SSL"}</span>
                    </div>
                    {plan !== 'free' && (
                      <div className="flex gap-1.5">
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-white/10 text-white border border-white/5 uppercase">Visa</span>
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-white/10 text-white border border-white/5 uppercase">Mastercard</span>
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex gap-2.5 items-start">
                      <AlertCircle className="w-4.5 h-4.5 text-rose-400 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  {plan === 'free' ? (
                    <div className="space-y-6">
                      <div className="p-5 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs space-y-2">
                        <p className="font-bold text-sm text-white flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-sky-400" />
                          Formule Gratuite Active d'un clic
                        </p>
                        <p className="leading-relaxed">
                          En choisissant la formule gratuite, vous pourrez planifier toutes vos tâches de la semaine en cours (du lundi au dimanche). 
                        </p>
                        <p className="leading-relaxed text-slate-400">
                          Aucune carte de paiement ou information bancaire n'est requise. Vous pourrez passer à la formule Premium mensuelle ou annuelle à tout moment pour débloquer le calendrier complet.
                        </p>
                      </div>

                      <button
                        onClick={() => handlePaymentSubmit()}
                        className="w-full py-4 rounded-xl text-sm font-bold bg-gradient-to-r from-sky-500 to-indigo-600 text-white hover:opacity-90 shadow-lg shadow-sky-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Activer mon compte gratuit 🐅</span>
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handlePaymentSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          Titulaire de la carte
                        </label>
                        <input
                          type="text"
                          required
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                          placeholder="Jean-Michel Tigre"
                          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:outline-none focus:border-violet-500 transition-all text-sm text-white placeholder-slate-600"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          Numéro de carte
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            value={cardNumber}
                            onChange={(e) => setCardNumber(e.target.value)}
                            placeholder="4242 4242 4242 4242"
                            className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:outline-none focus:border-violet-500 transition-all text-sm text-white placeholder-slate-600 font-mono"
                          />
                          <CreditCard className="w-5 h-5 text-slate-500 absolute left-4 top-3" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            Date d'expiration
                          </label>
                          <input
                            type="text"
                            required
                            value={expiry}
                            onChange={(e) => setExpiry(e.target.value)}
                            placeholder="MM/AA"
                            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:outline-none focus:border-violet-500 transition-all text-sm text-white placeholder-slate-600 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            CVC / CVV
                          </label>
                          <input
                            type="password"
                            maxLength={4}
                            required
                            value={cvc}
                            onChange={(e) => setCvc(e.target.value)}
                            placeholder="•••"
                            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:outline-none focus:border-violet-500 transition-all text-sm text-white placeholder-slate-600 font-mono"
                          />
                        </div>
                      </div>

                      <div className="pt-3 flex gap-3 flex-col sm:flex-row">
                        <button
                          type="button"
                          onClick={handleAutofill}
                          className="w-full sm:w-auto px-4 py-3 rounded-xl text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
                        >
                          Auto-remplir carte de test
                        </button>
                        <button
                          type="submit"
                          className="flex-1 px-6 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90 shadow-lg shadow-violet-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>S'abonner pour {plan === 'monthly' ? '1,00 €' : '10,00 €'}</span>
                        </button>
                      </div>
                    </form>
                  )}
                </motion.div>
              )}

              {paymentStep === 'processing' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="py-12 flex flex-col items-center justify-center text-center space-y-4"
                >
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin" />
                    <Lock className="w-5 h-5 text-violet-400 absolute inset-0 m-auto" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-white">Connexion sécurisée...</h3>
                    <p className="text-xs text-slate-400">Transmission chiffrée de la transaction en cours.</p>
                  </div>
                </motion.div>
              )}

              {paymentStep === '3ds' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="py-12 flex flex-col items-center justify-center text-center space-y-4"
                >
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                    <ShieldCheck className="w-5 h-5 text-emerald-400 absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-white">Validation 3D Secure 2.0...</h3>
                    <p className="text-xs text-slate-400">Authentification de votre carte auprès de votre banque.</p>
                  </div>
                </motion.div>
              )}

              {paymentStep === 'success' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-12 flex flex-col items-center justify-center text-center space-y-4"
                >
                  <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400 animate-bounce" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-emerald-400">
                      {plan === 'free' ? "Compte Activé !" : "Paiement Reçu !"}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {plan === 'free' ? "Votre formule gratuite est prête. Redirection en cours..." : "Votre abonnement Premium est maintenant activé."}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between text-[11px] text-slate-500 mt-8 relative z-10 border-t border-slate-900 pt-4">
        <span>Tiger Task &copy; 2026. Tous droits réservés.</span>
        <span className="flex items-center gap-1">
          <Lock className="w-3 h-3 text-slate-500" />
          Paiements cryptés via Stripe Sandbox
        </span>
      </div>
    </div>
  );
}
