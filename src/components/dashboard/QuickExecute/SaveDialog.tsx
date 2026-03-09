import { useState, useRef, useEffect } from 'react';
import { colors } from '../../../config/theme';
import { useAccentColor } from '../../../hooks/useAccentColor';
import { X } from 'lucide-react';

interface SaveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  defaultName?: string;
}

export function SaveDialog({ isOpen, onClose, onSave, defaultName = '' }: SaveDialogProps) {
  const accent = useAccentColor();
  const [name, setName] = useState(defaultName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen, defaultName]);

  const handleSubmit = () => {
    if (name.trim()) {
      const finalName = name.endsWith('.lua') || name.endsWith('.luau') ? name : `${name}.lua`;
      onSave(finalName);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10002,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#12121a',
          border: '1px solid #2a2a35',
          borderRadius: 12,
          padding: 24,
          minWidth: 320,
          boxShadow: '0 16px 64px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: colors.textWhite }}>Save Script</span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: colors.textMuted,
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, color: colors.textMuted, display: 'block', marginBottom: 8 }}>
            Script Name
          </label>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') onClose();
            }}
            placeholder="my-script.lua"
            style={{
              width: '100%',
              background: '#1a1a1f',
              border: `1px solid ${accent.primary}40`,
              borderRadius: 8,
              padding: '10px 14px',
              color: colors.textWhite,
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: '#1a1a1f',
              border: '1px solid #2a2a35',
              borderRadius: 8,
              padding: '8px 16px',
              color: colors.textMuted,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{
              background: accent.primary,
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
