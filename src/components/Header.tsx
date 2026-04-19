import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Settings, Copy, Check, Maximize2, LogOut, Cloud, RefreshCw, Clock, X, ChevronRight, Lock } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { config } from '../config';
import { ChangePasswordModal } from './ChangePasswordModal';

interface HeaderProps {
  suiAddress: string;
  userEmail: string | null;
  isSyncing: boolean;
  lastSyncId: string | null;
  onSync: () => void;
  onLock: () => void;
  onLogout: () => void;
  onExpand: () => void;
  timeoutMinutes: number;
  updateTimeout: (mins: number) => void;
}

export function Header({ 
  suiAddress, 
  userEmail, 
  isSyncing, 
  lastSyncId, 
  onSync, 
  onLock,
  onLogout, 
  onExpand,
  timeoutMinutes,
  updateTimeout
}: HeaderProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showSettings) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);

  const handleCopy = () => {
    navigator.clipboard.writeText(suiAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const truncateAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <>
      <header className="px-5 pt-5 pb-3 flex items-center justify-between relative z-30">
      <div className="flex items-center gap-2.5">
        <Shield className="w-5 h-5" strokeWidth={2.5} />
        <span className="text-[15px] font-semibold tracking-tight">Orion</span>
      </div>

      <div className="flex items-center gap-1">
        {/* Identity Pill */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/[0.04] hover:bg-black/[0.08] transition-colors text-left"
        >
          <div className={`w-2 h-2 rounded-full shrink-0 ${copied ? 'bg-accent' : 'bg-accent animate-pulse'}`} />
          <div className="flex flex-col min-w-0">
            {userEmail && <span className="text-[10px] text-muted truncate block leading-tight">{userEmail}</span>}
            <span className="text-[11px] font-mono font-medium text-black leading-tight flex items-center gap-1">
              {copied ? 'Copied!' : truncateAddr(suiAddress)}
              {!copied && <Copy className="w-3 h-3 text-black/30" />}
              {copied && <Check className="w-3 h-3 text-accent" />}
            </span>
          </div>
        </button>

        {/* Sync Indicator */}
        <button
          onClick={onSync}
          disabled={isSyncing}
          title={lastSyncId ? `Last sync: ${lastSyncId.slice(0, 8)}...` : 'Not synced'}
          className={`p-1.5 rounded-md transition-colors ${isSyncing ? 'bg-black/5 text-muted' : 'text-black/40 hover:text-black hover:bg-black/5'}`}
        >
          {isSyncing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Cloud className={`w-4 h-4 ${lastSyncId ? 'text-accent' : ''}`} />
          )}
        </button>

        <button onClick={onExpand} className="p-1.5 rounded-md hover:bg-black/5 text-black/40 hover:text-black transition-colors">
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* Settings */}
        <div className="relative" ref={settingsRef}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-md transition-colors ${showSettings ? 'bg-black/5 text-black' : 'text-black/40 hover:text-black hover:bg-black/5'}`}
          >
            <Settings className="w-4 h-4" />
          </button>
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-1.5 w-52 card p-1 z-50 shadow-lg"
              >
                <button
                  onClick={() => {
                    setShowTimeoutModal(true);
                    setShowSettings(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-black/5 transition-colors text-[13px] font-medium mb-0.5"
                >
                  <div className="flex items-center gap-2.5 whitespace-nowrap">
                    <Clock className="w-3.5 h-3.5 text-muted" />
                    Vault Timeout
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-accent font-mono">
                      {timeoutMinutes === 0 ? 'Never' : `${timeoutMinutes}m`}
                    </span>
                    <ChevronRight className="w-3 h-3 text-black/20" />
                  </div>
                </button>

                <button
                  onClick={() => {
                    setShowChangePasswordModal(true);
                    setShowSettings(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-black/5 transition-colors text-[13px] font-medium mb-0.5"
                >
                  <Lock className="w-3.5 h-3.5 text-muted" />
                  Change Master Password
                </button>

                <button
                  onClick={() => {
                    onLock();
                    setShowSettings(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-black/5 transition-colors text-[13px] font-medium mb-0.5"
                >
                  <Lock className="w-3.5 h-3.5 text-muted" />
                  Lock vault
                </button>

                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-red-50 text-red-600 transition-colors text-[13px] font-medium"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Log out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Timeout Selection Modal */}
      <AnimatePresence>
        {showTimeoutModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-5">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTimeoutModal(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
            />
            
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="w-full max-w-[280px] bg-white rounded-2xl shadow-2xl p-5 relative z-10 border border-black/5"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-accent" />
                  </div>
                  <h3 className="text-sm font-semibold">Vault Timeout</h3>
                </div>
                <button
                  onClick={() => setShowTimeoutModal(false)}
                  className="p-1.5 rounded-full hover:bg-black/5 text-black/30 hover:text-black transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {config.security.timeoutOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      updateTimeout(opt.value);
                      setShowTimeoutModal(false);
                    }}
                    className={`flex items-center justify-between p-3 rounded-xl transition-all border ${
                      timeoutMinutes === opt.value
                        ? 'bg-black border-black text-white shadow-md pt-3.5 pb-3.5'
                        : 'bg-black/[0.02] border-transparent hover:border-black/10 text-black'
                    }`}
                  >
                    <div className="text-left">
                      <p className="text-[13px] font-semibold">{opt.label}</p>
                      <p className={`text-[10px] mt-0.5 ${timeoutMinutes === opt.value ? 'text-white/60' : 'text-muted'}`}>
                        {opt.desc}
                      </p>
                    </div>
                    {timeoutMinutes === opt.value && (
                      <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              
              <p className="text-[10px] text-center text-muted mt-5 px-2">
                The vault will automatically lock after the selected period of inactivity.
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </header>

      <AnimatePresence>
        {showChangePasswordModal && (
          <ChangePasswordModal 
            suiAddress={suiAddress}
            onClose={() => setShowChangePasswordModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
