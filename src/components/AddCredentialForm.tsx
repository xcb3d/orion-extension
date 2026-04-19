import { motion } from 'framer-motion';
import { X, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

interface AddCredentialFormProps {
  onAdd: (name: string, username: string, url: string, secret: string) => Promise<void>;
  onClose: () => void;
}

export function AddCredentialForm({ onAdd, onClose }: AddCredentialFormProps) {
  const [formData, setFormData] = useState({ name: '', username: '', url: '', secret: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.secret) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await onAdd(formData.name, formData.username, formData.url, formData.secret);
      onClose();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to save credential. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.form
      key="form"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold">New Credential</span>
        <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-black/5 text-black/40 hover:text-black">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-3">
        <input
          placeholder="Service name (e.g. GitHub)"
          className="w-full h-10 bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 text-[13px] outline-none focus:border-black/20 transition-colors placeholder:text-black/30 text-black"
          value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
        />
        <input
          placeholder="Username or email"
          className="w-full h-10 bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 text-[13px] outline-none focus:border-black/20 transition-colors placeholder:text-black/30 text-black"
          value={formData.username}
          onChange={e => setFormData({ ...formData, username: e.target.value })}
        />
        <input
          placeholder="Service URL (e.g. github.com)"
          className="w-full h-10 bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 text-[13px] outline-none focus:border-black/20 transition-colors placeholder:text-black/30 text-black"
          value={formData.url}
          onChange={e => setFormData({ ...formData, url: e.target.value })}
        />
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            className="w-full h-10 bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 pr-10 text-[13px] outline-none focus:border-black/20 transition-colors placeholder:text-black/30 text-black"
            value={formData.secret}
            onChange={e => setFormData({ ...formData, secret: e.target.value })}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-black/5 text-black/40 hover:text-black transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {error && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-red-50 text-red-500 p-2.5 rounded-lg text-[11px] font-medium border border-red-100"
        >
          {error}
        </motion.div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-10 bg-black text-white rounded-lg font-medium text-[13px] hover:bg-black/90 transition-colors disabled:opacity-40"
      >
        {isSubmitting ? 'Syncing to Walrus...' : 'Encrypt & Save'}
      </button>
    </motion.form>
  );
}
