import { motion } from 'framer-motion';
import { LogIn, Maximize2, Shield, Key } from 'lucide-react';

interface LoginViewProps {
  isLoggingIn: boolean;
  onLogin: () => void;
  onExpand: () => void;
}

export function LoginView({ isLoggingIn, onLogin, onExpand }: LoginViewProps) {
  return (
    <div className="flex flex-col min-h-[580px] bg-paper">
      <header className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5" strokeWidth={2.5} />
          <span className="text-[15px] font-semibold tracking-tight">Orion</span>
        </div>
        <button onClick={onExpand} className="p-1.5 rounded-md hover:bg-black/5 text-black/40 hover:text-black transition-colors">
          <Maximize2 className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-8 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-5 w-full"
        >
          <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center mx-auto">
            <Key className="w-6 h-6 text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-semibold tracking-tight">Secure Your Digital Life</h1>
            <p className="text-[13px] text-muted leading-relaxed max-w-[280px] mx-auto">
              Next-gen decentralized password management.
            </p>
          </div>
          <button
            onClick={onLogin}
            disabled={isLoggingIn}
            className="w-full h-12 bg-black text-white rounded-xl font-medium text-[13px] hover:bg-black/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {isLoggingIn ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Continue with Google
              </>
            )}
          </button>
          <p className="text-[11px] text-muted">Powered by Sui zkLogin</p>
        </motion.div>
      </div>
    </div>
  );
}
