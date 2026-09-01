import React, { useState } from 'react';
import { Trash2, Shield, X, AlertTriangle, Check } from 'lucide-react';

interface DeleteDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleteByUsername: (username: string) => Promise<boolean>;
  onShowToast: (text: string, subtext?: string) => void;
}

export const DeleteDataModal: React.FC<DeleteDataModalProps> = ({
  isOpen,
  onClose,
  onDeleteByUsername,
  onShowToast
}) => {
  const [username, setUsername] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setIsDeleting(true);
    const cleanUser = username.trim().replace(/^@/, '');
    const success = await onDeleteByUsername(cleanUser);
    setIsDeleting(false);

    if (success) {
      onShowToast(`Deleted data for @${cleanUser}`, 'Profile and related roasts removed successfully.');
      setUsername('');
      onClose();
    } else {
      onShowToast(`Profile @${cleanUser} not found`, 'Double check the spelling of the username handle.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center border border-red-500/30">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">
                Delete My Data
              </h3>
              <p className="text-[11px] text-zinc-500 font-mono">Zero-Questions Removal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-white rounded-lg hover:bg-[#1f1f1f]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed">
          If you or someone else listed your handle and you would like your profile and its associated roasts erased, enter your username below to wipe it completely from our database.
        </p>

        <form onSubmit={handleDelete} className="space-y-3 pt-1">
          <div>
            <label className="block text-xs font-mono font-bold text-zinc-400 mb-1">
              Username Handle to Remove:
            </label>
            <input
              type="text"
              id="input-delete-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your_username"
              className="w-full bg-[#0a0a0a] border border-[#2e2e2e] focus:border-red-500 rounded-xl px-3.5 py-2 text-sm text-white font-mono placeholder-zinc-600 focus:outline-none"
              required
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-[#181818] hover:bg-[#222] text-zinc-300 font-mono font-bold text-xs rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-confirm-delete-data"
              disabled={isDeleting || !username.trim()}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-mono font-black text-xs uppercase rounded-xl transition-colors shadow-lg"
            >
              {isDeleting ? 'Deleting...' : 'Erase Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
