import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Copy, Eye, EyeOff, Globe, Check, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { SecretEntry } from '../lib/vault';
import { MessageType } from '../extension/messaging';
import { EditCredentialForm } from './EditCredentialForm';

interface CredentialDetailViewProps {
  entry: SecretEntry;
  onBack: () => void;
  onAutofill: () => void;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, name: string, username: string, url: string, newPassword?: string) => Promise<void>;
}

export function CredentialDetailView({ entry, onBack, onAutofill, onDelete, onUpdate }: CredentialDetailViewProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [decryptedPassword, setDecryptedPassword] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'username' | 'password' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset password state if the entry changes (e.g. after update)
  useEffect(() => {
    setDecryptedPassword(null);
    setShowPassword(false);
  }, [entry.id, entry.payload, entry.iv]);

  const fetchPassword = async (): Promise<string | null> => {
    if (decryptedPassword) return decryptedPassword;
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: MessageType.GET_DECRYPTED, payload: entry }, (response) => {
        if (response?.password) {
          setDecryptedPassword(response.password);
          resolve(response.password);
        } else {
          resolve(null);
        }
      });
    });
  };

  const handleCopy = async (field: 'username' | 'password', text: string) => {
    try {
      let content = text;
      if (field === 'password') {
        const pass = await fetchPassword();
        if (pass) content = pass;
      }
      await navigator.clipboard.writeText(content);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  const togglePasswordVisibility = async () => {
    if (!showPassword) {
      await fetchPassword();
    }
    setShowPassword(!showPassword);
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await onDelete(entry.id);
      onBack(); // Quay về danh sách sau khi xóa
    } catch (e) {
      console.error('Failed to delete', e);
    } finally {
      setIsDeleting(false);
    }
  };

  // Nếu đang ở chế độ chỉnh sửa
  if (isEditing) {
    return (
      <EditCredentialForm
        entry={entry}
        onSave={onUpdate}
        onClose={() => setIsEditing(false)}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[11px] font-medium text-black/60 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-black/60 hover:text-black hover:bg-black/5 transition-colors"
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-red-500/70 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
          <button
            onClick={onAutofill}
            className="px-2.5 py-1 rounded-md bg-black text-white text-[11px] font-medium hover:bg-black/90 transition-colors"
          >
            Fill Page
          </button>
        </div>
      </div>

      {/* Detail Card */}
      <div className="card-interactive p-4 space-y-4">
        <div className="border-b border-black/5 pb-3">
          <h3 className="text-[15px] font-semibold truncate">{entry.name}</h3>
          {entry.url && (
            <div className="flex items-center gap-1.5 mt-1 text-black/50 hover:text-black transition-colors cursor-pointer" onClick={() => window.open(entry.url, '_blank')}>
              <Globe className="w-3 h-3" />
              <span className="text-[11px] truncate">{entry.url}</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {/* Username */}
          <div className="group relative">
            <p className="text-[10px] font-medium uppercase tracking-wider text-black/40 mb-1">Username / Email</p>
            <div className="flex items-center justify-between bg-black/[0.02] rounded-md px-3 py-2 border border-black/5">
              <span className="text-[13px] font-mono truncate">{entry.username}</span>
              <button
                onClick={() => handleCopy('username', entry.username)}
                className="p-1.5 rounded-md hover:bg-black/5 text-black/40 hover:text-black transition-colors"
              >
                {copiedField === 'username' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Password */}
          <div className="group relative">
            <p className="text-[10px] font-medium uppercase tracking-wider text-black/40 mb-1">Password</p>
            <div className="flex items-center justify-between bg-black/[0.02] rounded-md px-3 py-2 border border-black/5">
              <span className="text-[13px] font-mono tracking-wider truncate">
                {showPassword && decryptedPassword ? decryptedPassword : '••••••••••••'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={togglePasswordVisibility}
                  className="p-1.5 rounded-md hover:bg-black/5 text-black/40 hover:text-black transition-colors"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => handleCopy('password', '')}
                  className="p-1.5 rounded-md hover:bg-black/5 text-black/40 hover:text-black transition-colors"
                >
                  {copiedField === 'password' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirm Dialog */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="card border border-red-100 p-4 space-y-3"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[13px] font-semibold">Delete Credential?</p>
                <p className="text-[11px] text-black/50 mt-0.5">
                  "<span className="font-medium text-black/70">{entry.name}</span>" will be permanently removed from your vault.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 px-3 py-1.5 rounded-md text-[12px] font-medium border border-black/10 hover:bg-black/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-3 py-1.5 rounded-md text-[12px] font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
