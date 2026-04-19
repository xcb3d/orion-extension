import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, Eye, EyeOff, KeyRound } from 'lucide-react';

interface MasterPasswordViewProps {
  hasLocalPin: boolean;
  error: string | null;
  isLoggingIn: boolean;
  onInitialize: (password: string, recoveryCode: string) => Promise<boolean>;
  onInitializationComplete: (password: string) => void;
  onUnlock: (password: string) => void;
  onRecover?: (newPassword: string, recoveryCode: string) => void;
  onLogout: () => void;
}

export function MasterPasswordView({ hasLocalPin, error, isLoggingIn, onInitialize, onInitializationComplete, onUnlock, onRecover, onLogout }: MasterPasswordViewProps) {
  const [isRecovering, setIsRecovering] = useState(false);
  const mode = isRecovering ? 'recover' : (!hasLocalPin ? 'create' : 'unlock');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [showRecoveryCode, setShowRecoveryCode] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const generateRecoveryCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous characters
    let code = 'ORION-';
    const randomArray = new Uint8Array(12);
    window.crypto.getRandomValues(randomArray);
    
    for (let i = 0; i < 12; i++) {
      if (i > 0 && i % 4 === 0) code += '-';
      // Use modulo to pick a character, ensuring it's cryptographically secure
      code += chars.charAt(randomArray[i] % chars.length);
    }
    return code;
  };

  const rules = (mode === 'create' || mode === 'recover') ? [
    { label: '8+ characters', valid: password.length >= 8 },
    { label: 'Letters', valid: /[a-zA-Z]/.test(password) },
    { label: 'Numbers', valid: /\d/.test(password) },
  ] : [];

  const isPasswordValid = (mode === 'create' || mode === 'recover') ? rules.every(r => r.valid) : password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPasswordValid) {
      if (mode === 'create') {
        const newCode = generateRecoveryCode();
        setRecoveryCode(newCode);
        const success = await onInitialize(password, newCode);
        if (success) {
          setShowRecoveryCode(true);
        }
      } else if (mode === 'recover') {
        if (password !== confirmPassword) return;
        if (!recoveryCode) return;
        onRecover?.(password, recoveryCode);
      } else {
        // [Hackathon Note] We skip strict validation for demo purposes
        onUnlock(password);
      }
    }
  };

  if (showRecoveryCode) {
    return (
      <div className="flex flex-col min-h-[580px] bg-paper p-8">
        <header className="flex items-center gap-2.5 mb-12">
          <Shield className="w-5 h-5" strokeWidth={2.5} />
          <span className="text-[15px] font-semibold tracking-tight">Orion</span>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center -mt-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-[320px] space-y-6"
          >
            <div className="space-y-2 text-center">
              <h1 className="text-xl font-semibold tracking-tight text-black">Emergency Kit</h1>
              <p className="text-[13px] text-muted">
                This is your only way to recover your vault if you forget your Master Password. 
                <strong className="text-black block mt-1">Save it somewhere safe.</strong>
              </p>
            </div>
            
            <div className="bg-black/[0.03] border border-black/10 rounded-2xl p-6 text-center shadow-inner">
              <code className="text-[16px] font-mono font-bold tracking-widest text-black break-all">
                {recoveryCode}
              </code>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(recoveryCode);
                }}
                className="w-full h-10 bg-white border border-black/10 text-black rounded-xl font-medium text-[13px] hover:bg-black/5 transition-colors"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={() => {
                  onInitializationComplete(password);
                }}
                className="w-full h-12 bg-black text-white rounded-xl font-medium text-[13px] hover:bg-black/90 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-black/10"
              >
                I have saved my Recovery Code
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[580px] bg-paper p-8">
      <header className="flex items-center gap-2.5 mb-12">
        <Shield className="w-5 h-5" strokeWidth={2.5} />
        <span className="text-[15px] font-semibold tracking-tight">Orion</span>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center -mt-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[320px] space-y-8"
        >
          <div className="space-y-2 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-black">
              {mode === 'create' ? 'Set Master Password' : (mode === 'recover' ? 'Recover Vault' : 'Unlock Vault')}
            </h1>
            <p className="text-[13px] text-muted">
              {mode === 'create' 
                ? 'Create a master password for your new secure vault.' 
                : (mode === 'recover' ? 'Enter your recovery kit code and a new master password.' : 'Enter your master password to unlock your vault.')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-100 p-3 rounded-xl mb-4">
                <p className="text-[12px] text-red-600 font-medium text-center">{error}</p>
              </div>
            )}

            {mode === 'recover' && (
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                  <Shield className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                  placeholder="Recovery Code (e.g. ORION-...)"
                  className="w-full h-14 bg-black/[0.03] border border-black/[0.08] rounded-2xl pl-12 pr-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all font-mono"
                  required
                />
              </div>
            )}

            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'recover' ? "New Master Password" : "Secure Master Password"}
                autoFocus
                className="w-full h-14 bg-black/[0.03] border border-black/[0.08] rounded-2xl pl-12 pr-12 text-[15px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-black transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {mode === 'recover' && (
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm New Password"
                  className="w-full h-14 bg-black/[0.03] border border-black/[0.08] rounded-2xl pl-12 pr-12 text-[15px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-black transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}

            <div className="flex gap-4 px-2 pt-1">
              {rules.map((rule, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full transition-colors ${rule.valid ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500/40'}`} />
                  <span className={`text-[10px] font-medium transition-colors ${rule.valid ? 'text-green-600' : 'text-muted'}`}>
                    {rule.label}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={!isPasswordValid || isLoggingIn || (mode === 'recover' && password !== confirmPassword)}
              className="w-full h-12 bg-black text-white rounded-xl font-medium text-[13px] hover:bg-black/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-30 shadow-lg shadow-black/10"
            >
              {isLoggingIn ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{mode === 'create' ? 'Initializing Vault...' : (mode === 'recover' ? 'Recovering...' : 'Authenticating...')}</span>
                </div>
              ) : (
                mode === 'create' ? 'Protect Vault' : (mode === 'recover' ? 'Recover Vault' : 'Unlock Vault')
              )}
            </button>

            {mode === 'unlock' && (
              <div className="text-center mt-2">
                <button
                  type="button"
                  onClick={() => setIsRecovering(true)}
                  className="text-[11px] text-muted hover:text-black transition-colors underline"
                >
                  Forgot Master Password?
                </button>
              </div>
            )}
            {mode === 'recover' && (
              <div className="text-center mt-2">
                <button
                  type="button"
                  onClick={() => setIsRecovering(false)}
                  className="text-[11px] text-muted hover:text-black transition-colors underline"
                >
                  Back to Unlock
                </button>
              </div>
            )}
          </form>
        </motion.div>
      </div>

      <footer className="mt-auto py-4 flex flex-col items-center justify-center gap-2">
        <div className="flex items-center gap-2">
            <Lock className="w-3 h-3 text-muted" />
            <span className="text-[10px] text-muted font-mono uppercase tracking-widest">Secured</span>
        </div>
        <button 
            onClick={onLogout}
            className="text-[11px] text-muted hover:text-black transition-colors mt-2 underline"
        >
            Logout / Switch Account
        </button>
      </footer>
    </div>
  );
}
