import { motion } from 'framer-motion';
import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Save } from 'lucide-react';
import type { SecretEntry } from '../lib/vault';

interface EditCredentialFormProps {
  entry: SecretEntry;
  onSave: (id: string, name: string, username: string, url: string, newPassword?: string) => Promise<void>;
  onClose: () => void;
}

export function EditCredentialForm({ entry, onSave, onClose }: EditCredentialFormProps) {
  const [name, setName] = useState(entry.name);
  const [username, setUsername] = useState(entry.username);
  const [url, setUrl] = useState(entry.url || '');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim()) {
      setError('Name and username are required.');
      return;
    }
    try {
      setIsSaving(true);
      setError(null);
      // Chỉ truyền newPassword nếu người dùng có điền vào
      await onSave(entry.id, name.trim(), username.trim(), url.trim(), newPassword || undefined);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-[11px] font-medium text-black/60 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Cancel
        </button>
        <span className="text-[13px] font-semibold">Edit Credential</span>
      </div>

      <form onSubmit={handleSubmit} className="card p-4 space-y-3">
        {/* Name */}
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-black/40 mb-1 block">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 text-[13px] bg-black/[0.02] border border-black/10 rounded-md focus:outline-none focus:border-black/30 transition-colors"
            placeholder="e.g. Gmail"
          />
        </div>

        {/* Username */}
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-black/40 mb-1 block">
            Username / Email
          </label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full px-3 py-2 text-[13px] font-mono bg-black/[0.02] border border-black/10 rounded-md focus:outline-none focus:border-black/30 transition-colors"
            placeholder="user@example.com"
          />
        </div>

        {/* URL */}
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-black/40 mb-1 block">
            Website URL
          </label>
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            className="w-full px-3 py-2 text-[13px] font-mono bg-black/[0.02] border border-black/10 rounded-md focus:outline-none focus:border-black/30 transition-colors"
            placeholder="https://example.com"
          />
        </div>

        {/* New Password */}
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-black/40 mb-1 block">
            New Password <span className="normal-case text-black/30">(leave blank to keep current)</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 pr-9 text-[13px] font-mono bg-black/[0.02] border border-black/10 rounded-md focus:outline-none focus:border-black/30 transition-colors"
              placeholder="Enter new password..."
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-black/40 hover:text-black transition-colors"
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-[11px] text-red-500">{error}</p>
        )}

        <button
          type="submit"
          disabled={isSaving}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-black text-white text-[12px] font-medium hover:bg-black/85 transition-colors disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </motion.div>
  );
}
