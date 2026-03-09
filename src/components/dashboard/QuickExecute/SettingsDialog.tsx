import { useState, useRef, useEffect } from 'react';
import { colors } from '../../../config/theme';
import { useAccentColor } from '../../../hooks/useAccentColor';
import { getQuickExecuteSettings, saveQuickExecuteSettings, formatKeybind } from '../../../stores/quickExecuteStore';
import { X, Keyboard } from 'lucide-react';

interface QuickExecuteSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type EditingField = 'toggle' | 'execute' | 'save' | null;

export function QuickExecuteSettingsDialog({ isOpen, onClose }: QuickExecuteSettingsDialogProps) {
  const accent = useAccentColor();
  const [settings, setSettings] = useState(getQuickExecuteSettings());
  const [editingField, setEditingField] = useState<EditingField>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingField]);

  useEffect(() => {
    setSettings(getQuickExecuteSettings());
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent, field: EditingField) => {
    e.preventDefault();
    if (e.key === 'Escape') {
      setEditingField(null);
      return;
    }
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

    const keybind = formatKeybind(e.nativeEvent);
    if (field === 'toggle') {
      saveQuickExecuteSettings({ toggleKeybind: keybind });
      setSettings((s) => ({ ...s, toggleKeybind: keybind }));
    } else if (field === 'execute') {
      saveQuickExecuteSettings({ executeKeybind: keybind });
      setSettings((s) => ({ ...s, executeKeybind: keybind }));
    } else if (field === 'save') {
      saveQuickExecuteSettings({ saveKeybind: keybind });
      setSettings((s) => ({ ...s, saveKeybind: keybind }));
    }
    setEditingField(null);
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
        zIndex: 10001,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#12121a',
          border: '1px solid #2a2a35',
          borderRadius: 12,
          padding: 24,
          minWidth: 360,
          boxShadow: '0 16px 64px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Keyboard size={20} style={{ color: accent.primary }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: colors.textWhite }}>Quick Execute Keybinds</span>
          </div>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <KeybindRow
            label="Toggle Menu"
            description="Open/close the Quick Execute menu"
            keybind={settings.toggleKeybind}
            isEditing={editingField === 'toggle'}
            onEdit={() => setEditingField('toggle')}
            onKeyDown={(e) => handleKeyDown(e, 'toggle')}
            onBlur={() => setEditingField(null)}
            inputRef={editingField === 'toggle' ? inputRef : undefined}
            accentColor={accent.primary}
          />
          <KeybindRow
            label="Execute Script"
            description="Run the selected script"
            keybind={settings.executeKeybind}
            isEditing={editingField === 'execute'}
            onEdit={() => setEditingField('execute')}
            onKeyDown={(e) => handleKeyDown(e, 'execute')}
            onBlur={() => setEditingField(null)}
            inputRef={editingField === 'execute' ? inputRef : undefined}
            accentColor={accent.primary}
          />
          <KeybindRow
            label="Save Script"
            description="Save the current script"
            keybind={settings.saveKeybind}
            isEditing={editingField === 'save'}
            onEdit={() => setEditingField('save')}
            onKeyDown={(e) => handleKeyDown(e, 'save')}
            onBlur={() => setEditingField(null)}
            inputRef={editingField === 'save' ? inputRef : undefined}
            accentColor={accent.primary}
          />
        </div>
      </div>
    </div>
  );
}

interface KeybindRowProps {
  label: string;
  description: string;
  keybind: string;
  isEditing: boolean;
  onEdit: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onBlur: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  accentColor: string;
}

function KeybindRow({ label, description, keybind, isEditing, onEdit, onKeyDown, onBlur, inputRef, accentColor }: KeybindRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: colors.textWhite, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{description}</div>
      </div>
      {isEditing ? (
        <input
          ref={inputRef}
          placeholder="Press keys..."
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          style={{
            width: 100,
            background: '#1a1a1f',
            border: `1px solid ${accentColor}`,
            borderRadius: 6,
            padding: '6px 10px',
            color: colors.textWhite,
            fontSize: 12,
            outline: 'none',
            textAlign: 'center',
          }}
        />
      ) : (
        <button
          onClick={onEdit}
          style={{
            background: '#1a1a1f',
            border: '1px solid #2a2a35',
            borderRadius: 6,
            padding: '6px 12px',
            color: colors.textWhite,
            fontSize: 12,
            cursor: 'pointer',
            minWidth: 80,
            textAlign: 'center',
          }}
        >
          {keybind}
        </button>
      )}
    </div>
  );
}
