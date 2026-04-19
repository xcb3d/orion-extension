import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { MessageType } from '../extension/messaging';
import { sha256 } from 'hash-wasm';

import { LocalStorageKey, SessionStorageKey } from '../extension/constants';

interface Props {
  onClose: () => void;
  suiAddress: string;
}

export function ChangePasswordModal({ onClose, suiAddress }: Props) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const rules = [
    { label: '8+ characters', valid: newPin.length >= 8 },
    { label: 'Letters', valid: /[a-zA-Z]/.test(newPin) },
    { label: 'Numbers', valid: /\d/.test(newPin) },
  ];
  const isPasswordValid = rules.every(r => r.valid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isPasswordValid) {
      setError('New password does not meet security requirements');
      return;
    }
    if (newPin !== confirmPin) {
      setError('New passwords do not match');
      return;
    }

    try {
      setIsLoading(true);
      
      // Verify current PIN matches session
      const sessionRes = await chrome.storage.session.get(['pin']);
      if (sessionRes.pin !== currentPin) {
        throw new Error('Incorrect current password');
      }

      // Derive new cryptoSecret
      const newCryptoSecret = await sha256(newPin + suiAddress);

      // Fetch required data for sync
      const sessionResData = await chrome.storage.session.get([
        SessionStorageKey.JWT,
        SessionStorageKey.ZKLOGIN_STATE,
        SessionStorageKey.ZK_PROOF
      ]);
      const localResData = await chrome.storage.local.get([LocalStorageKey.ORION_SEAL_OBJECT_ID]);

      const jwt = sessionResData[SessionStorageKey.JWT];
      const zkStateStr = sessionResData[SessionStorageKey.ZKLOGIN_STATE] as string | undefined;
      const zkProofStr = sessionResData[SessionStorageKey.ZK_PROOF] as string | undefined;
      
      const zkState = JSON.parse(zkStateStr || '{}');
      const zkProof = JSON.parse(zkProofStr || 'null');
      const objectId = localResData[LocalStorageKey.ORION_SEAL_OBJECT_ID];

      if (!jwt || !objectId) throw new Error('Missing authentication data. Please relogin.');

      // Send to background to re-encrypt DEK and sync
      const res = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage({
          type: MessageType.CHANGE_MASTER_PASSWORD,
          payload: {
            newPin,
            newCryptoSecret,
            jwt,
            zkState,
            zkProof,
            objectId
          }
        }, resolve);
      });

      if (res.error) throw new Error(res.error);
      
      // Success!
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-5">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        className="w-full max-w-[320px] bg-white rounded-2xl shadow-2xl p-5 relative z-10 border border-black/5"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
              <Lock className="w-4 h-4 text-accent" />
            </div>
            <h3 className="text-sm font-semibold">Change Master Password</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/5 text-black/30 hover:text-black transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-[11px] font-semibold text-muted mb-1.5 block uppercase tracking-wider">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPin ? 'text' : 'password'}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                className="w-full h-10 px-3 pr-10 bg-black/[0.03] border border-transparent rounded-lg text-sm focus:bg-white focus:border-accent/30 focus:ring-2 focus:ring-accent/10 transition-all outline-none"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPin(!showCurrentPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-black/5 text-black/40 hover:text-black transition-colors"
              >
                {showCurrentPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          
          <div>
            <label className="text-[11px] font-semibold text-muted mb-1.5 block uppercase tracking-wider">New Password</label>
            <div className="relative">
              <input
                type={showNewPin ? 'text' : 'password'}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="w-full h-10 px-3 pr-10 bg-black/[0.03] border border-transparent rounded-lg text-sm focus:bg-white focus:border-accent/30 focus:ring-2 focus:ring-accent/10 transition-all outline-none"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPin(!showNewPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-black/5 text-black/40 hover:text-black transition-colors"
              >
                {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            
            <div className="flex gap-4 px-1 mt-2">
              {rules.map((rule, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full transition-colors ${rule.valid ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500/40'}`} />
                  <span className={`text-[10px] font-medium transition-colors ${rule.valid ? 'text-green-600' : 'text-muted'}`}>
                    {rule.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted mb-1.5 block uppercase tracking-wider">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirmPin ? 'text' : 'password'}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                className="w-full h-10 px-3 pr-10 bg-black/[0.03] border border-transparent rounded-lg text-sm focus:bg-white focus:border-accent/30 focus:ring-2 focus:ring-accent/10 transition-all outline-none"
                placeholder="••••••••"
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPin(!showConfirmPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-black/5 text-black/40 hover:text-black transition-colors"
              >
                {showConfirmPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-[12px] text-red-500 font-medium text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || !isPasswordValid || newPin !== confirmPin || !currentPin}
            className="h-10 mt-2 bg-black text-white rounded-lg text-sm font-semibold hover:bg-black/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Change Password'
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
