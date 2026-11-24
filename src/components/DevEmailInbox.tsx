import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, RefreshCw, Trash2, X, ChevronRight, Inbox, Clock, User } from 'lucide-react';

interface SimulatedEmail {
  id: string;
  to: string;
  subject: string;
  html: string;
  sentAt: string;
}

export default function DevEmailInbox() {
  const [isOpen, setIsOpen] = useState(false);
  const [emails, setEmails] = useState<SimulatedEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<SimulatedEmail | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dev/emails');
      if (res.ok) {
        const data = await res.json();
        setEmails(data);
      }
    } catch (err) {
      console.error("Error fetching simulated emails:", err);
    } finally {
      setLoading(false);
    }
  };

  const clearEmails = async () => {
    if (!window.confirm("Voulez-vous vider la boîte de réception simulée ?")) return;
    try {
      const res = await fetch('/api/dev/emails', { method: 'DELETE' });
      if (res.ok) {
        setEmails([]);
        setSelectedEmail(null);
      }
    } catch (err) {
      console.error("Error clearing emails:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEmails();
      const interval = setInterval(fetchEmails, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-lg shadow-violet-600/30 border border-violet-500 transition-all cursor-pointer group"
      >
        <div className="relative">
          <Mail className="w-4.5 h-4.5 group-hover:scale-110 transition-transform" />
          {emails.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
        </div>
        <span>Email Simulator</span>
        {emails.length > 0 && (
          <span className="bg-slate-950/40 text-[10px] px-1.5 py-0.5 rounded-md font-mono">
            {emails.length}
          </span>
        )}
      </button>

      {/* Main Panel Overlay */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
            {/* Click outside backdrop to close */}
            <div className="flex-1" onClick={() => setIsOpen(false)} />

            {/* Sidebar Slideover */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl relative"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Console Email</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Simulation des emails transactionnels</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={fetchEmails}
                    disabled={loading}
                    title="Rafraîchir"
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-4.5 h-4.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  {emails.length > 0 && (
                    <button
                      onClick={clearEmails}
                      title="Vider la boîte"
                      className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>

              {/* Sub-Header info / Notice */}
              <div className="bg-slate-950/30 px-4 py-2 border-b border-slate-800/60 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Régénéré en temps réel par les actions d'inscription et d'achat</span>
                <span className="font-mono text-emerald-400">STATUS: ACTIVE</span>
              </div>

              {/* List / Detail View Split */}
              <div className="flex-1 overflow-hidden flex flex-col relative bg-slate-950/20">
                <AnimatePresence mode="wait">
                  {!selectedEmail ? (
                    /* LIST OF SENT EMAILS */
                    <motion.div
                      key="list"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full overflow-y-auto p-4 space-y-3"
                    >
                      {emails.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500">
                          <Inbox className="w-10 h-10 mb-2.5 text-slate-600 animate-pulse" />
                          <p className="text-xs font-bold">Aucun email envoyé pour l'instant</p>
                          <p className="text-[10px] text-slate-500 max-w-[280px] mt-1">
                            Créez un compte ou abonnez-vous pour voir les emails de confirmation instantanément.
                          </p>
                        </div>
                      ) : (
                        emails.map((email) => (
                          <div
                            key={email.id}
                            onClick={() => setSelectedEmail(email)}
                            className="p-4 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/80 transition-all cursor-pointer group flex items-start gap-3.5"
                          >
                            <div className="w-8.5 h-8.5 rounded-full bg-violet-600/15 border border-violet-500/10 flex items-center justify-center shrink-0 text-violet-400 font-bold text-xs">
                              {email.to.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-bold text-slate-200 truncate group-hover:text-white transition-colors">
                                  {email.subject}
                                </p>
                                <span className="text-[9px] font-mono text-slate-500 shrink-0 flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  {formatTime(email.sentAt)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                                <User className="w-3 h-3 text-slate-500" />
                                <span className="truncate">Pour : {email.to}</span>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 shrink-0 mt-2 transition-transform group-hover:translate-x-0.5" />
                          </div>
                        ))
                      )}
                    </motion.div>
                  ) : (
                    /* EMAIL DETAILED RENDER VIEW */
                    <motion.div
                      key="detail"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="h-full flex flex-col bg-slate-900"
                    >
                      {/* Sub header for detail */}
                      <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs">
                        <button
                          onClick={() => setSelectedEmail(null)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          &larr; Retour à la liste
                        </button>
                        <span className="text-[10px] text-slate-500 font-mono">
                          ID: {selectedEmail.id.substring(0, 8)}...
                        </span>
                      </div>

                      {/* Meta information */}
                      <div className="p-4 border-b border-slate-800/80 space-y-1.5 text-xs bg-slate-950/20 font-mono">
                        <div>
                          <span className="text-slate-500">Sujet : </span>
                          <span className="text-violet-400 font-bold">{selectedEmail.subject}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Destinataire : </span>
                          <span className="text-slate-300">{selectedEmail.to}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Envoyé le : </span>
                          <span className="text-slate-400">{new Date(selectedEmail.sentAt).toLocaleString('fr-FR')}</span>
                        </div>
                      </div>

                      {/* Render HTML content securely */}
                      <div className="flex-1 overflow-y-auto p-4 bg-slate-950/40">
                        <div 
                          className="rounded-xl overflow-hidden bg-slate-950 p-2.5 shadow-inner border border-slate-900 mx-auto max-w-[500px]"
                          dangerouslySetInnerHTML={{ __html: selectedEmail.html }} 
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
