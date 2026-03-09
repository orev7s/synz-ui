import { useState, useEffect, useRef, useSyncExternalStore, useCallback } from 'react';
import { getCurrentWindow, PhysicalPosition } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { emit } from '@tauri-apps/api/event';
import { colors } from '../../../config/theme';
import { useAccentColor } from '../../../hooks/useAccentColor';
import { CodeEditor } from '../../../editor';
import { fileStore, subscribeToFileStore, VirtualFile, initializeFileStore } from '../../../stores/fileStore';
import {
  getQuickExecuteState,
  getQuickExecuteSettings,
  subscribeToQuickExecute,
  setSelectedScript,
  setEditorContent,
  matchesKeybind,
  loadQuickExecuteSettings,
  getScriptKeybind,
  setScriptKeybind,
  formatKeybind,
} from '../../../stores/quickExecuteStore';
import { transformScript } from '../../../stores/qolStore';
import { executeScript } from '../../../stores/attachStore';
import { QuickExecuteSettingsDialog } from './SettingsDialog';
import { SaveDialog } from './SaveDialog';
import { Play, Save, Settings, ChevronDown, X, File, Keyboard } from 'lucide-react';
import '../../../styles/globals.css';

export function QuickExecuteWindow() {
  const accent = useAccentColor();
  const state = useSyncExternalStore(subscribeToQuickExecute, getQuickExecuteState);
  const [scripts, setScripts] = useState<VirtualFile[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [editingKeybindScript, setEditingKeybindScript] = useState<string | null>(null);
  const keybindInputRef = useRef<HTMLInputElement>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const windowPos = useRef({ x: 0, y: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
    const root = document.getElementById('root');
    if (root) root.style.background = 'transparent';
    emit('quick-execute-ready');
  }, []);

  useEffect(() => {
    loadQuickExecuteSettings();
    initializeFileStore();
  }, []);

  useEffect(() => {
    const preventContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-allow-context-menu]')) {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', preventContextMenu);
    return () => document.removeEventListener('contextmenu', preventContextMenu);
  }, []);

  useEffect(() => {
    let interval: number | null = null;
    const checkMainWindow = async () => {
      const mainWindow = await WebviewWindow.getByLabel('main');
      if (!mainWindow) {
        const quickExecWindow = getCurrentWindow();
        await quickExecWindow.close();
      }
    };
    interval = window.setInterval(checkMainWindow, 500);
    return () => { if (interval) clearInterval(interval); };
  }, []);

  useEffect(() => {
    const updateScripts = () => setScripts(fileStore.getAllFiles());
    updateScripts();
    return subscribeToFileStore(updateScripts);
  }, []);

  useEffect(() => {
    if (scripts.length > 0 && !state.selectedScriptId) {
      const firstScript = scripts[0];
      setSelectedScript(firstScript.id, firstScript.content);
    }
  }, [scripts, state.selectedScriptId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

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
    setDropdownOpen(false);
  }, []);

  const handleNewScript = useCallback(() => {
    setIsCreatingNew(true);
    setSaveDialogOpen(true);
    setDropdownOpen(false);
  }, []);

  const handleKeybindClick = useCallback((e: React.MouseEvent, scriptId: string) => {
    e.stopPropagation();
    setEditingKeybindScript(scriptId);
    setTimeout(() => keybindInputRef.current?.focus(), 0);
  }, []);

  const handleKeybindKeyDown = useCallback(async (e: React.KeyboardEvent, scriptId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') {
      setEditingKeybindScript(null);
      return;
    }
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

    const keybind = formatKeybind(e.nativeEvent);
    await setScriptKeybind(scriptId, keybind);
    setEditingKeybindScript(null);
  }, []);

  const handleRemoveKeybind = useCallback(async (e: React.MouseEvent, scriptId: string) => {
    e.stopPropagation();
    await setScriptKeybind(scriptId, null);
  }, []);

  const handleCreateNew = useCallback(async (name: string) => {
    const newFile = await fileStore.createFile(name, '');
    setSelectedScript(newFile.id, newFile.content);
  }, []);

  const handleDragStart = async (e: React.MouseEvent) => {
    const win = getCurrentWindow();
    const pos = await win.outerPosition();
    windowPos.current = { x: pos.x, y: pos.y };
    dragStart.current = { x: e.screenX, y: e.screenY };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = async (e: MouseEvent) => {
      const dx = e.screenX - dragStart.current.x;
      const dy = e.screenY - dragStart.current.y;
      const win = getCurrentWindow();
      await win.setPosition(new PhysicalPosition(windowPos.current.x + dx, windowPos.current.y + dy));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const settings = getQuickExecuteSettings();

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
  }, [state.selectedScriptId, state.editorContent, handleExecute]);

  const handleClose = async () => {
    const win = getCurrentWindow();
    await win.hide();
  };

  const selectedScript = state.selectedScriptId ? fileStore.getFile(state.selectedScriptId) : null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 8,
          background: colors.bgDark,
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        <div
          onMouseDown={handleDragStart}
          style={{
            height: 40,
            padding: '0 12px',
            borderBottom: `1px solid ${colors.border}`,
            cursor: isDragging ? 'grabbing' : 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            userSelect: 'none',
            background: colors.panelDark,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              ref={dropdownRef}
              style={{ position: 'relative' }}
            >
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: colors.surfaceDark,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 6,
                  padding: '5px 10px',
                  color: colors.textWhite,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  minWidth: 120,
                  justifyContent: 'space-between',
                }}
              >
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 100,
                }}>
                  {selectedScript?.name || 'New Script'}
                </span>
                <ChevronDown size={12} style={{ opacity: 0.6, flexShrink: 0 }} />
              </button>

              {dropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    background: colors.panelDark,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    padding: 4,
                    minWidth: 180,
                    maxHeight: 240,
                    overflowY: 'auto',
                    zIndex: 100,
                    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                  }}
                >
                  <button
                    onClick={handleNewScript}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 5,
                      color: accent.primary,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceDark}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    + New Script
                  </button>
                  {scripts.length > 0 && (
                    <div style={{ height: 1, background: colors.border, margin: '4px 0' }} />
                  )}
                  {scripts.map((script) => {
                    const scriptKeybind = getScriptKeybind(script.id);
                    const isEditingThis = editingKeybindScript === script.id;
                    return (
                      <div
                        key={script.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px',
                        }}
                      >
                        <button
                          onClick={() => handleScriptSelect(script)}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 8px',
                            background: state.selectedScriptId === script.id ? `${accent.primary}15` : 'transparent',
                            border: 'none',
                            borderRadius: 5,
                            color: colors.textWhite,
                            fontSize: 12,
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) => {
                            if (state.selectedScriptId !== script.id) {
                              e.currentTarget.style.background = colors.surfaceDark;
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = state.selectedScriptId === script.id ? `${accent.primary}15` : 'transparent';
                          }}
                        >
                          <File size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {script.name}
                          </span>
                        </button>
                        {isEditingThis ? (
                          <input
                            ref={keybindInputRef}
                            placeholder="Press key..."
                            onKeyDown={(e) => handleKeybindKeyDown(e, script.id)}
                            onBlur={() => setEditingKeybindScript(null)}
                            style={{
                              width: 70,
                              background: colors.surfaceDark,
                              border: `1px solid ${accent.primary}`,
                              borderRadius: 4,
                              padding: '4px 6px',
                              color: colors.textWhite,
                              fontSize: 10,
                              outline: 'none',
                              textAlign: 'center',
                            }}
                          />
                        ) : scriptKeybind ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <span
                              onClick={(e) => handleKeybindClick(e, script.id)}
                              style={{
                                background: `${accent.primary}20`,
                                border: `1px solid ${accent.primary}40`,
                                borderRadius: 4,
                                padding: '3px 6px',
                                color: accent.primary,
                                fontSize: 9,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {scriptKeybind}
                            </span>
                            <button
                              onClick={(e) => handleRemoveKeybind(e, script.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: colors.textMuted,
                                cursor: 'pointer',
                                padding: 2,
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => handleKeybindClick(e, script.id)}
                            style={{
                              background: 'transparent',
                              border: `1px solid ${colors.border}`,
                              borderRadius: 4,
                              padding: '3px 6px',
                              color: colors.textMuted,
                              fontSize: 9,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <Keyboard size={10} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconButton
              icon={<Settings size={14} />}
              onClick={() => setSettingsOpen(true)}
            />
            <IconButton
              icon={<Save size={14} />}
              onClick={() => {
                if (state.selectedScriptId) {
                  fileStore.updateFile(state.selectedScriptId, state.editorContent);
                } else {
                  setSaveDialogOpen(true);
                }
              }}
            />
            <button
              onClick={handleExecute}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: accent.primary,
                border: 'none',
                borderRadius: 5,
                padding: '5px 12px',
                color: accent.contrastText,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                marginLeft: 4,
              }}
            >
              <Play size={12} fill={accent.contrastText} />
              Run
            </button>
            <div style={{ width: 1, height: 16, background: colors.border, margin: '0 6px' }} />
            <IconButton
              icon={<X size={14} />}
              onClick={handleClose}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          <CodeEditor
            value={state.editorContent}
            onChange={setEditorContent}
            onExecute={handleExecute}
            onSave={() => {
              if (state.selectedScriptId) {
                fileStore.updateFile(state.selectedScriptId, state.editorContent);
              } else {
                setSaveDialogOpen(true);
              }
            }}
            fileId={state.selectedScriptId || 'quick-execute'}
            fileName={selectedScript?.name || 'quick-execute.lua'}
          />
        </div>
      </div>

      <QuickExecuteSettingsDialog isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <SaveDialog
        isOpen={saveDialogOpen}
        onClose={() => { setSaveDialogOpen(false); setIsCreatingNew(false); }}
        onSave={isCreatingNew ? handleCreateNew : handleSave}
        defaultName={isCreatingNew ? 'script' : (selectedScript?.name.replace(/\.(lua|luau)$/, '') || 'script')}
      />
    </>
  );
}

interface IconButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
}

function IconButton({ icon, onClick }: IconButtonProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hovered ? colors.surfaceDark : 'transparent',
        border: 'none',
        borderRadius: 5,
        color: colors.textMuted,
        cursor: 'pointer',
      }}
    >
      {icon}
    </button>
  );
}
