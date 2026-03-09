import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { colors } from '../../../config/theme';
import { useAccentColor } from '../../../hooks/useAccentColor';
import { VirtualFile } from '../../../stores/fileStore';
import { getScriptKeybind, setScriptKeybind, formatKeybind } from '../../../stores/quickExecuteStore';
import { Keyboard, Trash2, Pencil } from 'lucide-react';
import { RenameDialog } from './RenameDialog';

interface ScriptListProps {
  scripts: VirtualFile[];
  selectedId: string | null;
  onSelect: (script: VirtualFile) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onExecuteScript: (script: VirtualFile) => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  scriptId: string | null;
}

interface RenameState {
  isOpen: boolean;
  scriptId: string | null;
  currentName: string;
}

export function ScriptList({ scripts, selectedId, onSelect, onDelete, onRename, onExecuteScript }: ScriptListProps) {
  const accent = useAccentColor();
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, scriptId: null });
  const [editingKeybind, setEditingKeybind] = useState<string | null>(null);
  const [renameDialog, setRenameDialog] = useState<RenameState>({ isOpen: false, scriptId: null, currentName: '' });
  const keybindInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingKeybind && keybindInputRef.current) {
      keybindInputRef.current.focus();
    }
  }, [editingKeybind]);

  const handleContextMenu = (e: React.MouseEvent, scriptId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 160;
    const menuHeight = 120;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);
    setContextMenu({ visible: true, x, y, scriptId });
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, scriptId: null });
  };

  const handleAssignKeybind = () => {
    if (contextMenu.scriptId) {
      setEditingKeybind(contextMenu.scriptId);
    }
    closeContextMenu();
  };

  const handleKeybindKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    if (e.key === 'Escape') {
      setEditingKeybind(null);
      return;
    }
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

    const keybind = formatKeybind(e.nativeEvent);
    if (editingKeybind) {
      setScriptKeybind(editingKeybind, keybind);
      setEditingKeybind(null);
    }
  };

  const handleRename = () => {
    const script = scripts.find((s) => s.id === contextMenu.scriptId);
    if (script) {
      setRenameDialog({ isOpen: true, scriptId: script.id, currentName: script.name });
    }
    closeContextMenu();
  };

  const handleRenameSubmit = (newName: string) => {
    if (renameDialog.scriptId) {
      onRename(renameDialog.scriptId, newName);
    }
    setRenameDialog({ isOpen: false, scriptId: null, currentName: '' });
  };

  const handleDelete = () => {
    if (contextMenu.scriptId) {
      onDelete(contextMenu.scriptId);
    }
    closeContextMenu();
  };

  useEffect(() => {
    const handleClickOutside = () => closeContextMenu();
    if (contextMenu.visible) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu.visible]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, overflowY: 'auto', flex: 1 }}>
      {scripts.map((script) => {
        const keybind = getScriptKeybind(script.id);
        const isSelected = selectedId === script.id;
        const isEditingKeybind = editingKeybind === script.id;

        return (
          <div
            key={script.id}
            onClick={() => onSelect(script)}
            onContextMenu={(e) => handleContextMenu(e, script.id)}
            onDoubleClick={() => onExecuteScript(script)}
            style={{
              padding: '10px 12px',
              borderRadius: 6,
              background: isSelected ? `${accent.primary}20` : 'transparent',
              border: isSelected ? `1px solid ${accent.primary}40` : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 13, color: colors.textWhite, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {script.name}
            </span>

            {isEditingKeybind ? (
              <input
                ref={keybindInputRef}
                placeholder="Press keys..."
                onKeyDown={handleKeybindKeyDown}
                onBlur={() => setEditingKeybind(null)}
                style={{
                  width: 80,
                  background: '#1a1a1f',
                  border: `1px solid ${accent.primary}`,
                  borderRadius: 4,
                  padding: '2px 6px',
                  color: colors.textWhite,
                  fontSize: 11,
                  outline: 'none',
                  textAlign: 'center',
                }}
              />
            ) : keybind ? (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingKeybind(script.id);
                }}
                style={{
                  fontSize: 10,
                  color: colors.textMuted,
                  background: '#1a1a1f',
                  padding: '2px 6px',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                {keybind}
              </span>
            ) : null}
          </div>
        );
      })}

      {contextMenu.visible && createPortal(
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: '#1a1a1f',
            border: '1px solid #2a2a35',
            borderRadius: 8,
            padding: 4,
            zIndex: 10000,
            minWidth: 160,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <ContextMenuItem icon={<Keyboard size={14} />} label="Assign Keybind" onClick={handleAssignKeybind} />
          <ContextMenuItem icon={<Pencil size={14} />} label="Rename" onClick={handleRename} />
          <ContextMenuItem icon={<Trash2 size={14} />} label="Delete" onClick={handleDelete} danger />
        </div>,
        document.body
      )}

      <RenameDialog
        isOpen={renameDialog.isOpen}
        onClose={() => setRenameDialog({ isOpen: false, scriptId: null, currentName: '' })}
        onRename={handleRenameSubmit}
        currentName={renameDialog.currentName}
      />
    </div>
  );
}

interface ContextMenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

function ContextMenuItem({ icon, label, onClick, danger }: ContextMenuItemProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 6,
        cursor: 'pointer',
        background: hovered ? (danger ? '#FF4D6A20' : '#2a2a35') : 'transparent',
        color: danger ? '#FF4D6A' : colors.textWhite,
        fontSize: 13,
        transition: 'background 0.1s ease',
      }}
    >
      {icon}
      {label}
    </div>
  );
}
