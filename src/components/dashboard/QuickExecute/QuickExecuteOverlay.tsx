import { useState, useEffect, useRef, useSyncExternalStore, useCallback } from 'react';
import { colors } from '../../../config/theme';
import { useAccentColor } from '../../../hooks/useAccentColor';
import { CodeEditor } from '../../../editor';
import { fileStore, subscribeToFileStore, VirtualFile } from '../../../stores/fileStore';
import {
  getQuickExecuteState,
  getQuickExecuteSettings,
  subscribeToQuickExecute,
  setQuickExecuteVisible,
  setSelectedScript,
  setEditorContent,
  matchesKeybind,
  loadQuickExecuteSettings,
} from '../../../stores/quickExecuteStore';
import { ScriptList } from './ScriptList';
import { QuickExecuteSettingsDialog } from './SettingsDialog';
import { SaveDialog } from './SaveDialog';
import { transformScript } from '../../../stores/qolStore';
import { executeScript } from '../../../stores/attachStore';
import { Play, Save, Settings, GripVertical } from 'lucide-react';

function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
}

export function QuickExecuteOverlay() {
  const accent = useAccentColor();
  const state = useSyncExternalStore(subscribeToQuickExecute, getQuickExecuteState);
  const [scripts, setScripts] = useState<VirtualFile[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 700, height: 450 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadQuickExecuteSettings();
  }, []);

  useEffect(() => {
    const updateScripts = () => setScripts(fileStore.getAllFiles());
    updateScripts();
    return subscribeToFileStore(updateScripts);
  }, []);

  useEffect(() => {
    if (state.isVisible && scripts.length > 0 && !state.selectedScriptId) {
      const firstScript = scripts[0];
      setSelectedScript(firstScript.id, firstScript.content);
    }
  }, [state.isVisible, scripts, state.selectedScriptId]);

  const handleExecute = useCallback(async () => {
    if (!state.editorContent.trim()) return;
    try {
      await executeScript(transformScript(state.editorContent));
    } catch (err) {
      console.error('Execution failed:', err);
    }
  }, [state.editorContent]);

  const handleSave = useCallback(async (name: string) => {
    if (state.selectedScriptId) {
      await fileStore.updateFile(state.selectedScriptId, state.editorContent);
    } else {
      const newFile = await fileStore.createFile(name, state.editorContent);
      setSelectedScript(newFile.id, newFile.content);
    }
  }, [state.selectedScriptId, state.editorContent]);

  const handleScriptSelect = useCallback((script: VirtualFile) => {
    setSelectedScript(script.id, script.content);
  }, []);

  const handleScriptDelete = useCallback(async (id: string) => {
    await fileStore.deleteFile(id);
    if (state.selectedScriptId === id) {
      const remaining = fileStore.getAllFiles();
      if (remaining.length > 0) {
        setSelectedScript(remaining[0].id, remaining[0].content);
      } else {
        setSelectedScript(null, '');
      }
    }
  }, [state.selectedScriptId]);

  const handleScriptRename = useCallback(async (id: string, newName: string) => {
    await fileStore.renameFile(id, newName);
  }, []);

  const handleExecuteScript = useCallback((script: VirtualFile) => {
    setSelectedScript(script.id, script.content);
    handleExecute();
  }, [handleExecute]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const settings = getQuickExecuteSettings();
      if (!settings.enabled) return;

      if (matchesKeybind(e, settings.toggleKeybind)) {
        e.preventDefault();
        setQuickExecuteVisible(!state.isVisible);
        return;
      }

      if (!state.isVisible) {
        Object.entries(settings.scriptKeybinds).forEach(([scriptId, keybind]) => {
          if (matchesKeybind(e, keybind)) {
            e.preventDefault();
            const script = fileStore.getFile(scriptId);
            if (script) {
              console.log('Quick executing script:', script.name);
            }
          }
        });
        return;
      }

      if (matchesKeybind(e, settings.executeKeybind)) {
        e.preventDefault();
        handleExecute();
      }

      if (matchesKeybind(e, settings.saveKeybind)) {
        e.preventDefault();
        if (state.selectedScriptId) {
          fileStore.updateFile(state.selectedScriptId, state.editorContent);
        } else {
          setSaveDialogOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.isVisible, state.selectedScriptId, state.editorContent, handleExecute]);

  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    resizeStart.current = { x: e.clientX, y: e.clientY, width: size.width, height: size.height };
  };

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
      }
      if (isResizing) {
        const dx = e.clientX - resizeStart.current.x;
        const dy = e.clientY - resizeStart.current.y;
        setSize({
          width: Math.max(500, resizeStart.current.width + dx),
          height: Math.max(300, resizeStart.current.height + dy),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing]);

  if (!state.isVisible || !getQuickExecuteSettings().enabled) return null;

  const selectedScript = state.selectedScriptId ? fileStore.getFile(state.selectedScriptId) : null;

  return (
    <>
      <div
        ref={overlayRef}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height,
          zIndex: 9999,
          display: 'flex',
          gap: 8,
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            width: 200,
            background: 'rgba(12, 12, 18, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid #2a2a35',
            borderRadius: 12,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            onMouseDown={handleDragStart}
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #2a2a35',
              cursor: 'grab',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              userSelect: 'none',
            }}
          >
            <GripVertical size={14} style={{ color: colors.textMuted }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: colors.textWhite }}>Scripts</span>
          </div>
          <ScriptList
            scripts={scripts}
            selectedId={state.selectedScriptId}
            onSelect={handleScriptSelect}
            onDelete={handleScriptDelete}
            onRename={handleScriptRename}
            onExecuteScript={handleExecuteScript}
          />
        </div>

        <div
          style={{
            flex: 1,
            background: 'rgba(12, 12, 18, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid #2a2a35',
            borderRadius: 12,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            onMouseDown={handleDragStart}
            style={{
              padding: '10px 16px',
              borderBottom: '1px solid #2a2a35',
              cursor: 'grab',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              userSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <GripVertical size={14} style={{ color: colors.textMuted }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: colors.textWhite }}>
                {selectedScript?.name || 'Quick Execute'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <ActionButton
                icon={<Settings size={14} />}
                tooltip="Settings"
                onClick={() => setSettingsOpen(true)}
              />
              <ActionButton
                icon={<Save size={14} />}
                tooltip="Save"
                onClick={() => {
                  if (state.selectedScriptId) {
                    fileStore.updateFile(state.selectedScriptId, state.editorContent);
                  } else {
                    setSaveDialogOpen(true);
                  }
                }}
              />
              <ActionButton
                icon={<Play size={14} />}
                tooltip="Execute"
                onClick={handleExecute}
                primary
                accentColor={accent.primary}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'hidden' }}>
            <CodeEditor
              value={state.editorContent}
              onChange={setEditorContent}
              fileId={state.selectedScriptId || 'quick-execute'}
              fileName={selectedScript?.name || 'quick-execute.lua'}
            />
          </div>

          <div
            onMouseDown={handleResizeStart}
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: 16,
              height: 16,
              cursor: 'se-resize',
              background: 'transparent',
            }}
          />
        </div>
      </div>

      <QuickExecuteSettingsDialog isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <SaveDialog
        isOpen={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        onSave={handleSave}
        defaultName={selectedScript?.name.replace(/\.(lua|luau)$/, '') || 'script'}
      />
    </>
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  tooltip: string;
  onClick: () => void;
  primary?: boolean;
  accentColor?: string;
}

function ActionButton({ icon, tooltip, onClick, primary, accentColor }: ActionButtonProps) {
  const [hovered, setHovered] = useState(false);
  const contrastText = accentColor && primary ? (isLightColor(accentColor) ? '#0B0B0F' : '#fff') : colors.textMuted;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={tooltip}
      style={{
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: primary ? accentColor : hovered ? '#2a2a35' : 'transparent',
        border: 'none',
        borderRadius: 6,
        color: primary ? contrastText : colors.textMuted,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      {icon}
    </button>
  );
}
