import { motion, AnimatePresence } from 'framer-motion';
import { LockKeyhole, Plus, ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { AddCredentialForm } from './AddCredentialForm';
import { CredentialDetailView } from './CredentialDetailView';
import type { SecretEntry } from '../lib/vault';

interface DashboardProps {
  vault: SecretEntry[];
  isLoading: boolean;
  onAdd: (name: string, username: string, url: string, secret: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, name: string, username: string, url: string, newPassword?: string) => Promise<void>;
  onAutofill: (entry: SecretEntry) => void;
}

export function Dashboard({ vault, isLoading, onAdd, onDelete, onUpdate, onAutofill }: DashboardProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SecretEntry | null>(null);

  // Sync selectedItem với vault mới nhất sau mỗi lần edit/update
  useEffect(() => {
    if (selectedItem) {
      const updated = vault.find(e => e.id === selectedItem.id);
      if (updated) setSelectedItem(updated);
    }
  }, [vault]);

  const reveal = {
    initial: { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.2 }
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <AnimatePresence mode="wait">
        {showAddForm ? (
          <AddCredentialForm 
            key="add-form"
            onAdd={async (...args) => { await onAdd(...args); setShowAddForm(false); }} 
            onClose={() => setShowAddForm(false)} 
          />
        ) : selectedItem ? (
          <CredentialDetailView
            key="detail-view"
            entry={selectedItem}
            onBack={() => setSelectedItem(null)}
            onAutofill={() => onAutofill(selectedItem)}
            onDelete={onDelete}
            onUpdate={onUpdate}
          />
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Section Header */}
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold">Credentials</span>
              <div className="flex items-center gap-1.5">
                {!isLoading && <span className="label-muted mr-1">{vault.length}</span>}
                <button
                  onClick={() => setShowAddForm(true)}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black text-white text-[11px] font-medium hover:bg-black/90 transition-colors disabled:opacity-50"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </div>
            </div>

            {/* List */}
            <div className="space-y-2">
              {isLoading ? (
                // Skeleton Loader
                <>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="card-interactive p-3.5 flex items-center justify-between opacity-60">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-black/[0.04] animate-pulse" />
                        <div className="space-y-2">
                          <div className="h-3 w-24 bg-black/[0.04] rounded animate-pulse" />
                          <div className="h-2 w-32 bg-black/[0.03] rounded animate-pulse" />
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              ) : vault.length === 0 ? (
                <div className="card py-12 text-center">
                  <LockKeyhole className="w-8 h-8 text-black/10 mx-auto mb-3" />
                  <p className="text-[13px] font-medium text-black/40">No credentials yet</p>
                  <p className="text-[11px] text-muted mt-1">Click "Add" to store your first secret</p>
                </div>
              ) : (
                vault.map((item, i) => (
                  <motion.div
                    {...reveal}
                    transition={{ delay: i * 0.03 }}
                    key={item.id}
                    className="card-interactive p-3.5 flex items-center justify-between cursor-pointer group"
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-black/[0.04] flex items-center justify-center shrink-0 group-hover:bg-black group-hover:text-white transition-colors">
                        <LockKeyhole className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium truncate">{item.name}</p>
                        <p className="text-[11px] text-muted font-mono truncate mt-0.5">{item.username}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[11px] text-black/40 font-mono">View</span>
                      <ArrowRight className="w-3.5 h-3.5 text-black/40" />
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
