import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, 
  CalendarCheck, 
  TrendingUp, 
  ShieldCheck, 
  Zap, 
  Play, 
  Check, 
  ChevronRight, 
  Clock, 
  Target, 
  Smile, 
  Frown,
  HelpCircle
} from 'lucide-react';
import { STATUS_CONFIGS, TaskStatus } from '../types';

interface LandingPageProps {
  onLoginClick: () => void;
  onRegisterClick: (selectedPlan?: 'free' | 'monthly' | 'yearly') => void;
}

export default function LandingPage({ onLoginClick, onRegisterClick }: LandingPageProps) {
  const [selectedDemoStatus, setSelectedDemoStatus] = useState<TaskStatus>('white');
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('yearly');

  // Interactive local demo data to showcase how Flemme Index operates
  const demoStatuses: { status: TaskStatus; label: string; desc: string; flemmeWeight: number; colorHex: string }[] = [
    { status: 'white', label: 'À faire', desc: 'Tâche blanche: en attente de traitement.', flemmeWeight: 0, colorHex: '#cbd5e1' },
    { status: 'green', label: 'Faite !', desc: 'Tâche verte: fierté, accomplissement direct.', flemmeWeight: 0, colorHex: '#34d399' },
    { status: 'yellow', label: 'Reportée (flemme)', desc: 'Tâche jaune: décalée par flemme. Augmente légèrement votre indice.', flemmeWeight: 1, colorHex: '#fbbf24' },
    { status: 'red', label: 'Échouée / Flemme', desc: 'Tâche rouge: abandonnée par pure flemme. Augmente fortement votre indice (culpabilité).', flemmeWeight: 3, colorHex: '#f43f5e' },
    { status: 'blue', label: 'Récurrente finie', desc: 'Tâche bleue: récurrence achevée avec succès !', flemmeWeight: 0, colorHex: '#0ea5e9' },
    { status: 'purple', label: 'Reportée (volonté)', desc: 'Tâche violette: reportée indépendamment de votre volonté. Sans impact négatif.', flemmeWeight: 0, colorHex: '#a78bfa' },
    { status: 'black', label: 'Échec cuisant', desc: 'Tâche noire: échec triste mais acté. Pour apprendre de ses erreurs.', flemmeWeight: 0, colorHex: '#64748b' }
  ];

  const currentDemo = demoStatuses.find(d => d.status === selectedDemoStatus) || demoStatuses[0];

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans relative overflow-x-clip selection:bg-violet-600/40 selection:text-white">
      {/* Decorative blurred backgrounds */}
      <div className="absolute top-[-10%] left-[-20%] w-[1000px] h-[1000px] rounded-full bg-violet-600/5 blur-[160px] pointer-events-none" />
      <div className="absolute top-[30%] right-[-10%] w-[800px] h-[800px] rounded-full bg-emerald-500/5 blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-500/5 blur-[160px] pointer-events-none" />

      {/* 1. Header Navigation */}
      <header className="border-b border-white/5 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 md:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-emerald-400 p-[1.5px] flex items-center justify-center">
              <div className="w-full h-full rounded-xl bg-slate-950 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-violet-400" />
              </div>
            </div>
            <span className="text-base font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-violet-100 to-emerald-300">
              Tiger Task
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={onLoginClick}
              className="text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer py-2 px-3"
            >
              Se connecter
            </button>
            <button
              onClick={() => onRegisterClick()}
              className="text-xs font-bold bg-white text-slate-950 hover:bg-slate-200 transition-colors py-2 px-4 rounded-xl shadow-lg cursor-pointer"
            >
              Créer un compte
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 pt-16 md:pt-24 pb-12 text-center relative z-10 space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/15 text-violet-300 text-[11px] font-bold tracking-wide uppercase animate-fade-in mx-auto">
          <Zap className="w-3.5 h-3.5 text-violet-400" />
          <span>La méthode Fibre Tigre en version SaaS</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1] max-w-4xl mx-auto">
          L'organisation du temps inspirée de <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-indigo-200 to-emerald-300">Fibre Tigre</span>
        </h1>

        <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Reprenez le contrôle de vos journées grâce à une méthode scientifique, rigoureuse et subjective. 
          Mesurez votre volonté, acceptez votre flemme et organisez vos tâches jour par jour. Commencez gratuitement ou optez pour notre offre Premium.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button
            onClick={() => onRegisterClick('free')}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-95 shadow-xl shadow-violet-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Démarrer gratuitement 🐅</span>
            <ChevronRight className="w-4 h-4" />
          </button>
          <a
            href="#pricing"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-sm font-bold bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Voir les formules (Gratuit ou Premium dès 1€)</span>
          </a>
        </div>
      </section>

      {/* 3. Interactive Preview Playground / Method explanation */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 py-16 relative z-10">
        <div className="grid lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Block: Method Explanation */}
          <div className="lg:col-span-5 space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Une colorimétrie unique pour triompher de la procrastination
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Contrairement aux listes de tâches classiques qui créent de la frustration, la méthode de Fibre Tigre repose sur la responsabilité subjective. Chaque tâche se voit attribuer une note de priorité de 1 à 10 et un statut coloré précis lors de sa résolution.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex gap-4 items-start">
                <div className="w-8.5 h-8.5 rounded-xl bg-violet-600/15 border border-violet-500/10 flex items-center justify-center shrink-0">
                  <Target className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200">La Priorité Subjective (1 à 10)</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Notez l'importance réelle que vous donnez à une tâche. Pas de formules magiques, juste votre volonté.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-8.5 h-8.5 rounded-xl bg-emerald-500/15 border border-emerald-500/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200">Indice de Flemme Calculé</h4>
                  <p className="text-xs text-slate-400 mt-0.5">L'application calcule dynamiquement votre ratio de report par rapport aux tâches accomplies pour vous guider.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Block: Interactive Sandbox Card */}
          <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 md:p-8 backdrop-blur-md relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-3 bg-white/5 border-b border-l border-white/5 rounded-bl-xl text-[10px] font-mono text-slate-500 uppercase">
              Interactif
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Play className="w-4 h-4 text-violet-400 fill-violet-400/20" />
                  Simulateur de statut de tâche
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Cliquez sur un bouton de statut pour voir comment Fibre Tigre qualifie votre action de la journée.
                </p>
              </div>

              {/* Color list selector */}
              <div className="flex flex-wrap gap-2 py-2">
                {demoStatuses.map((d) => {
                  const conf = STATUS_CONFIGS[d.status];
                  const isSel = selectedDemoStatus === d.status;
                  return (
                    <button
                      key={d.status}
                      onClick={() => setSelectedDemoStatus(d.status)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        isSel 
                          ? `${conf.borderClass} ${conf.bgClass} scale-105 ${conf.colorClass}`
                          : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>

              {/* Demo task block mock rendering */}
              <div className="p-5 rounded-xl border bg-slate-950/80 relative transition-all" style={{ borderColor: currentDemo.colorHex + '25' }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Tâche de test</span>
                    <h4 className="text-sm font-bold text-slate-200 mt-0.5">Remplir la déclaration d'impôts annuelle</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {currentDemo.desc}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-center p-2 rounded bg-slate-900 border border-slate-800/80">
                    <span className="text-[9px] text-slate-500 uppercase font-mono">Priorité</span>
                    <span className="text-lg font-black text-violet-400 leading-none mt-0.5">8</span>
                  </div>
                </div>

                <div className="mt-4 pt-3.5 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    Statut actuel : 
                    <strong style={{ color: currentDemo.colorHex }}>{currentDemo.label}</strong>
                  </span>
                  {currentDemo.flemmeWeight > 0 ? (
                    <span className="text-rose-400 flex items-center gap-1 font-semibold">
                      <Frown className="w-3.5 h-3.5" />
                      Indice flemme +{currentDemo.flemmeWeight}
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                      <Smile className="w-3.5 h-3.5" />
                      Excellent !
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 4. Pricing Section */}
      <section id="pricing" className="max-w-5xl mx-auto px-4 md:px-6 py-20 relative z-10">
        <div className="text-center space-y-4 mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Une tarification simple et transparente</h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
            Pas de fonctionnalités cachées ni d'options complexes. Accédez à 100% de la puissance de Tiger Task.
          </p>

          {/* Toggle interval */}
          <div className="flex items-center justify-center gap-2 pt-4">
            <button
              onClick={() => setBillingInterval('monthly')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                billingInterval === 'monthly' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setBillingInterval('yearly')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer relative ${
                billingInterval === 'yearly' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Annuel
              <span className="absolute -top-3 -right-6 bg-emerald-500 text-slate-950 font-black text-[8px] px-1.5 py-0.5 rounded-full uppercase">
                -16%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">
          
          {/* Plan: Free */}
          <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700/80 transition-all flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-slate-200">Formule Gratuite</h3>
                <p className="text-xs text-slate-400 mt-1">L'essentiel pour organiser votre semaine en cours.</p>
              </div>
              <div className="py-2">
                <span className="text-4xl font-black">0,00 €</span>
                <span className="text-slate-500 text-xs ml-1">/ toujours</span>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-300 pt-4 border-t border-slate-800/60">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>Planning de la semaine en cours</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>Suivi de l'Indice de Flemme (hebdo)</span>
                </li>
                <li className="flex items-center gap-2.5 text-slate-500">
                  <span className="w-4 h-4 flex items-center justify-center shrink-0 font-bold">-</span>
                  <span>Pas d'accès hors semaine en cours</span>
                </li>
                <li className="flex items-center gap-2.5 text-slate-500">
                  <span className="w-4 h-4 flex items-center justify-center shrink-0 font-bold">-</span>
                  <span>Pas de rapports statistiques annuels</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => onRegisterClick('free')}
              className="w-full mt-8 py-3 rounded-xl text-xs font-bold bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 transition-all cursor-pointer text-center text-slate-300"
            >
              S'inscrire gratuitement
            </button>
          </div>

          {/* Plan A: Monthly */}
          <div className={`p-8 rounded-2xl bg-slate-900/40 border transition-all flex flex-col justify-between ${
            billingInterval === 'monthly' ? 'border-violet-500 ring-1 ring-violet-500/20 bg-slate-900/80 shadow-2xl' : 'border-slate-800/80'
          }`}>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-slate-200">Formule Mensuelle</h3>
                <p className="text-xs text-slate-400 mt-1">L'accès total et la flexibilité du mensuel.</p>
              </div>
              <div className="py-2">
                <span className="text-4xl font-black">1,00 €</span>
                <span className="text-slate-500 text-xs ml-1">/ mois</span>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-300 pt-4 border-t border-slate-800/60">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Planning interactif illimité</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Suivi de l'Indice & Volonté</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Analyses Bento en temps réel</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Sans engagement, résiliable</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => onRegisterClick('monthly')}
              className="w-full mt-8 py-3 rounded-xl text-xs font-bold bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 transition-all cursor-pointer text-center"
            >
              S'inscrire (1€/mois)
            </button>
          </div>

          {/* Plan B: Yearly */}
          <div className={`p-8 rounded-2xl bg-slate-900/40 border transition-all flex flex-col justify-between relative overflow-hidden ${
            billingInterval === 'yearly' ? 'border-violet-500 ring-1 ring-violet-500/20 bg-slate-900/85 shadow-2xl' : 'border-slate-800/80'
          }`}>
            <div className="absolute top-4 right-4 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[9px] font-extrabold px-2 py-0.5 rounded-full tracking-wider uppercase">
              Recommandé
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-slate-200">Formule Annuelle</h3>
                <p className="text-xs text-slate-400 mt-1">Un un complet d'organisation optimale, au meilleur prix.</p>
              </div>
              <div className="py-2">
                <span className="text-4xl font-black text-emerald-400">10,00 €</span>
                <span className="text-slate-500 text-xs ml-1">/ an</span>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-300 pt-4 border-t border-slate-800/60">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Tous les avantages Premium</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Accès prioritaire futures versions</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold text-emerald-300">Économisez 16% sur l'année</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Support prioritaire sous 24h</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => onRegisterClick('yearly')}
              className="w-full mt-8 py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-95 text-white shadow-lg shadow-violet-600/15 transition-all cursor-pointer text-center"
            >
              S'abonner (10€/an)
            </button>
          </div>

        </div>
      </section>

      {/* 5. Method FAQ section */}
      <section className="max-w-4xl mx-auto px-4 md:px-6 py-12 relative z-10 border-t border-slate-900">
        <div className="text-center space-y-4 mb-10">
          <HelpCircle className="w-8 h-8 text-violet-400 mx-auto" />
          <h2 className="text-xl font-bold">Foire aux questions</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 text-xs sm:text-sm">
          <div className="p-5 rounded-xl bg-slate-900/30 border border-slate-800/50 space-y-2">
            <h4 className="font-bold text-slate-200">Qui est Fibre Tigre ?</h4>
            <p className="text-slate-400 leading-relaxed">
              Fibre Tigre est un auteur et game designer français réputé, créateur de l'émission JDR "Aria" et animateur du podcast d'actualité "Trajectoires". Il a popularisé sa méthode personnelle d'organisation sur les réseaux sociaux.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/30 border border-slate-800/50 space-y-2">
            <h4 className="font-bold text-slate-200">Puis-je utiliser l'application gratuitement ?</h4>
            <p className="text-slate-400 leading-relaxed">
              Oui ! Notre <strong className="text-sky-400 font-bold">Formule Gratuite</strong> vous permet de planifier et d'organiser vos tâches pour toute la semaine en cours sans limite de temps. Pour planifier au-delà et débloquer les analyses Bento complètes, vous pouvez passer au Premium à tout moment.
            </p>
          </div>
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="max-w-7xl mx-auto px-4 md:px-6 py-12 text-center text-xs text-slate-500 border-t border-slate-900">
        <p>Tiger Task &copy; 2026. L'organisation du temps inspirée de Fibre Tigre.</p>
        <p className="mt-1 text-slate-600">Paiements simulés sécurisés. Aucun argent réel n'est transféré.</p>
      </footer>
    </div>
  );
}
