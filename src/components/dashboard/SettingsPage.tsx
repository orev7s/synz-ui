import { useState, useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { colors } from '../../config/theme';
import { useAccentColor } from '../../hooks/useAccentColor';
import {
  getSettings,
  loadSettings,
  updateEditorSetting,
  updateAutoAttachSetting,
  updateAppearanceSetting,
  updateWorkbenchSetting,
  subscribeToSettings,
  AppSettings,
} from '../../stores/settingsStore';
import {
  getQuickExecuteSettings,
  saveQuickExecuteSettings,
  loadQuickExecuteSettings,
  subscribeToQuickExecute,
  QuickExecuteSettings,
} from '../../stores/quickExecuteStore';
import {
  getQolSettings,
  loadQolSettings,
  subscribeToQol,
  setQolEnabled,
  getDefaultTransformations,
  addUserTransformation,
  updateUserTransformation,
  removeUserTransformation,
  QolSettings,
} from '../../stores/qolStore';
import {
  getKeybinds,
  loadKeybinds,
  saveKeybinds,
  subscribeToKeybinds,
  resetKeybinds,
  formatKeybind,
  KeybindsSettings,
  KeybindAction,
  KEYBIND_LABELS,
  KEYBIND_DESCRIPTIONS,
} from '../../stores/keybindsStore';
import { ArrowLeft, Layout, Type, Code, Zap, Keyboard, RotateCcw, Wand2, Plus, Trash2, Lock } from 'lucide-react';

function isLightAccent(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
}

interface SettingsPageProps {
  onBack: () => void;
}

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  accentColor: string;
}

function ToggleSwitch({ checked, onChange, disabled, accentColor }: ToggleSwitchProps) {
  const knobColor = checked && isLightAccent(accentColor) ? '#0B0B0F' : colors.textWhite;
  return (
    <div
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        background: checked ? accentColor : '#2a2a35',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s ease',
        position: 'relative',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: knobColor,
          position: 'absolute',
          top: 3,
          left: checked ? 23 : 3,
          transition: 'left 0.2s ease',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
        }}
      />
    </div>
  );
}

interface NumberInputProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  suffix?: string;
  accentColor: string;
}

function NumberInput({ value, min, max, step = 1, onChange, suffix, accentColor }: NumberInputProps) {
  const [inputValue, setInputValue] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setInputValue(String(value));
    }
  }, [value, focused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleBlur = () => {
    setFocused(false);
    let num = parseFloat(inputValue);
    if (isNaN(num)) num = value;
    num = Math.max(min, Math.min(max, num));
    if (step >= 1) num = Math.round(num);
    setInputValue(String(num));
    onChange(num);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  const increment = () => {
    const newValue = Math.min(max, value + step);
    onChange(newValue);
  };

  const decrement = () => {
    const newValue = Math.max(min, value - step);
    onChange(newValue);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button
        onClick={decrement}
        style={{
          width: 28,
          height: 28,
          background: '#1f1f25',
          border: 'none',
          borderRadius: 4,
          color: colors.textWhite,
          cursor: 'pointer',
          fontSize: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        −
      </button>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={inputValue}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          style={{
            width: 60,
            height: 28,
            background: '#1f1f25',
            border: focused ? `1px solid ${accentColor}` : '1px solid transparent',
            borderRadius: 4,
            color: colors.textWhite,
            fontSize: 13,
            textAlign: 'center',
            outline: 'none',
            paddingRight: suffix ? 20 : 0,
          }}
        />
        {suffix && (
          <span
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 11,
              color: colors.textMuted,
              pointerEvents: 'none',
            }}
          >
            {suffix}
          </span>
        )}
      </div>
      <button
        onClick={increment}
        style={{
          width: 28,
          height: 28,
          background: '#1f1f25',
          border: 'none',
          borderRadius: 4,
          color: colors.textWhite,
          cursor: 'pointer',
          fontSize: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        +
      </button>
    </div>
  );
}

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 0',
        borderBottom: '1px solid #1a1a1f',
      }}
    >
      <div style={{ flex: 1, paddingRight: 24 }}>
        <div style={{ fontSize: 14, color: colors.textWhite, fontWeight: 500 }}>{label}</div>
        {description && (
          <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>{description}</div>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  accentColor: string;
}

function TabButton({ active, onClick, icon, label, accentColor }: TabButtonProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        background: active ? '#1f1f25' : hovered ? '#18181d' : 'transparent',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        width: '100%',
        color: active ? colors.textWhite : colors.textMuted,
        transition: 'all 0.15s ease',
        textAlign: 'left',
        borderLeft: active ? `3px solid ${accentColor}` : '3px solid transparent',
      }}
    >
      <div style={{ color: active ? accentColor : 'inherit' }}>{icon}</div>
      <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
    </button>
  );
}

interface ColorButtonProps {
  color: string;
  selected: boolean;
  onClick: () => void;
}

function ColorButton({ color, selected, onClick }: ColorButtonProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: color,
        cursor: 'pointer',
        border: selected ? `3px solid ${isLightAccent(color) ? '#666' : colors.textWhite}` : '3px solid transparent',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        transform: hovered ? 'scale(1.1)' : 'scale(1)',
        transition: 'transform 0.15s ease, border 0.15s ease',
      }}
    />
  );
}

interface OptionButtonProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  accentColor: string;
}

function OptionButton({ label, selected, onClick, accentColor }: OptionButtonProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 16px',
        background: selected ? accentColor : hovered ? '#2a2a35' : '#1f1f25',
        border: 'none',
        borderRadius: 6,
        color: selected && isLightAccent(accentColor) ? '#0B0B0F' : colors.textWhite,
        fontSize: 13,
        cursor: 'pointer',
        transition: 'background 0.15s ease',
      }}
    >
      {label}
    </button>
  );
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [quickExecuteSettings, setQuickExecuteSettings] = useState<QuickExecuteSettings>(getQuickExecuteSettings());
  const [keybindsSettings, setKeybindsSettings] = useState<KeybindsSettings>(getKeybinds());
  const [qolSettings, setQolSettings] = useState<QolSettings>(getQolSettings());
  const [newPattern, setNewPattern] = useState('');
  const [newReplacement, setNewReplacement] = useState('');
  const [activeTab, setActiveTab] = useState<'editor' | 'appearance' | 'workbench' | 'client' | 'quickExecute' | 'keybinds' | 'qol'>('editor');
  const [editingKeybind, setEditingKeybind] = useState<'toggle' | 'execute' | 'save' | KeybindAction | null>(null);
  const keybindInputRef = useRef<HTMLInputElement>(null);
  const accent = useAccentColor();

  useEffect(() => {
    loadSettings();
    loadQuickExecuteSettings();
    loadKeybinds();
    loadQolSettings();
    const unsubscribe = subscribeToSettings(() => {
      setSettings(getSettings());
    });
    const unsubscribeQE = subscribeToQuickExecute(() => {
      setQuickExecuteSettings(getQuickExecuteSettings());
    });
    const unsubscribeKB = subscribeToKeybinds(() => {
      setKeybindsSettings(getKeybinds());
    });
    const unsubscribeQol = subscribeToQol(() => {
      setQolSettings(getQolSettings());
    });
    return () => {
      unsubscribe();
      unsubscribeQE();
      unsubscribeKB();
      unsubscribeQol();
    };
  }, []);

  useEffect(() => {
    if (editingKeybind && keybindInputRef.current) {
      keybindInputRef.current.focus();
    }
  }, [editingKeybind]);

  const handleKeybindKeyDown = (e: React.KeyboardEvent, field: 'toggle' | 'execute' | 'save' | KeybindAction) => {
    e.preventDefault();
    if (e.key === 'Escape') {
      setEditingKeybind(null);
      return;
    }
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

    const keybind = formatKeybind(e.nativeEvent);
    if (field === 'toggle') {
      saveQuickExecuteSettings({ toggleKeybind: keybind });
    } else if (field === 'execute') {
      saveQuickExecuteSettings({ executeKeybind: keybind });
    } else if (field === 'save') {
      saveQuickExecuteSettings({ saveKeybind: keybind });
    } else {
      saveKeybinds({ [field]: keybind });
    }
    setEditingKeybind(null);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'editor':
        return (
          <>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.textWhite, marginBottom: 8 }}>Editor</h2>
              <p style={{ fontSize: 13, color: colors.textMuted }}>Customize the code editor experience</p>
            </div>

            <SettingRow label="Font Size" description="Size of the text in the code editor">
              <NumberInput
                value={settings.editor.fontSize}
                min={10}
                max={24}
                onChange={(v) => updateEditorSetting('fontSize', v)}
                suffix="px"
                accentColor={accent.primary}
              />
            </SettingRow>

            <SettingRow label="Tab Size" description="Number of spaces per tab">
              <NumberInput
                value={settings.editor.tabSize}
                min={2}
                max={8}
                onChange={(v) => updateEditorSetting('tabSize', v)}
                accentColor={accent.primary}
              />
            </SettingRow>

            <SettingRow label="Minimap" description="Show code overview on the right side">
              <ToggleSwitch
                checked={settings.editor.minimap}
                onChange={(v) => updateEditorSetting('minimap', v)}
                accentColor={accent.primary}
              />
            </SettingRow>

            <SettingRow label="Word Wrap" description="Wrap long lines to fit the editor width">
              <ToggleSwitch
                checked={settings.editor.wordWrap}
                onChange={(v) => updateEditorSetting('wordWrap', v)}
                accentColor={accent.primary}
              />
            </SettingRow>

            <SettingRow label="Line Numbers" description="Show line numbers in the gutter">
              <ToggleSwitch
                checked={settings.editor.lineNumbers}
                onChange={(v) => updateEditorSetting('lineNumbers', v)}
                accentColor={accent.primary}
              />
            </SettingRow>

            <SettingRow label="Font Ligatures" description="Enable programming font ligatures">
              <ToggleSwitch
                checked={settings.editor.fontLigatures}
                onChange={(v) => updateEditorSetting('fontLigatures', v)}
                accentColor={accent.primary}
              />
            </SettingRow>

            <div style={{ marginBottom: 24, marginTop: 40 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.textWhite, marginBottom: 8 }}>Runtime Preparation</h2>
              <p style={{ fontSize: 13, color: colors.textMuted }}>Configure how Synapse Z readies the local execution runtime</p>
            </div>

            <SettingRow
              label="Auto Ready Runtime"
              description="Automatically mark the local runtime as ready when Synapse Z starts"
            >
              <ToggleSwitch
                checked={settings.autoAttach.enabled}
                onChange={(v) => updateAutoAttachSetting('enabled', v)}
                accentColor={accent.primary}
              />
            </SettingRow>

            <SettingRow
              label="Ready Delay"
              description="Time to wait before the runtime is marked ready (in milliseconds)"
            >
              <NumberInput
                value={settings.autoAttach.delay}
                min={0}
                max={5000}
                step={100}
                onChange={(v) => updateAutoAttachSetting('delay', v)}
                suffix="ms"
                accentColor={accent.primary}
              />
            </SettingRow>
          </>
        );

      case 'appearance':
        return (
          <>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.textWhite, marginBottom: 8 }}>Appearance</h2>
              <p style={{ fontSize: 13, color: colors.textMuted }}>Customize the look and feel of Synapse Z</p>
            </div>

            <SettingRow label="Accent Color" description="Primary color used throughout the application">
              <div style={{ display: 'flex', gap: 10 }}>
                {['#FFFFFF', '#60A5FA', '#34D399', '#F472B6', '#A78BFA', '#FBBF24', '#F87171'].map((color) => (
                  <ColorButton
                    key={color}
                    color={color}
                    selected={settings.appearance.accentColor === color}
                    onClick={() => updateAppearanceSetting('accentColor', color)}
                  />
                ))}
              </div>
            </SettingRow>

            <SettingRow label="Background Opacity" description="Opacity of the window background">
              <NumberInput
                value={Math.round(settings.appearance.backgroundOpacity * 100)}
                min={50}
                max={100}
                onChange={(v) => updateAppearanceSetting('backgroundOpacity', v / 100)}
                suffix="%"
                accentColor={accent.primary}
              />
            </SettingRow>
          </>
        );

      case 'workbench':
        return (
          <>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.textWhite, marginBottom: 8 }}>General</h2>
              <p style={{ fontSize: 13, color: colors.textMuted }}>Configure workspace behavior</p>
            </div>

            <SettingRow label="Startup Action" description="What to show when Synapse Z starts">
              <div style={{ display: 'flex', gap: 8 }}>
                <OptionButton
                  label="Welcome"
                  selected={settings.workbench.startupAction === 'welcome'}
                  onClick={() => updateWorkbenchSetting('startupAction', 'welcome')}
                  accentColor={accent.primary}
                />
                <OptionButton
                  label="New Tab"
                  selected={settings.workbench.startupAction === 'new'}
                  onClick={() => updateWorkbenchSetting('startupAction', 'new')}
                  accentColor={accent.primary}
                />
                <OptionButton
                  label="None"
                  selected={settings.workbench.startupAction === 'none'}
                  onClick={() => updateWorkbenchSetting('startupAction', 'none')}
                  accentColor={accent.primary}
                />
              </div>
            </SettingRow>

            <SettingRow label="Restore Tabs" description="Reopen previously open tabs when Synapse Z starts">
              <ToggleSwitch
                checked={settings.workbench.restoreTabs}
                onChange={(v) => updateWorkbenchSetting('restoreTabs', v)}
                accentColor={accent.primary}
              />
            </SettingRow>

            <SettingRow label="Floating Execute Button" description="Show a draggable execute button you can place anywhere">
              <ToggleSwitch
                checked={settings.workbench.floatingExecuteButton}
                onChange={(v) => updateWorkbenchSetting('floatingExecuteButton', v)}
                accentColor={accent.primary}
              />
            </SettingRow>

            <SettingRow label="Always on Top" description="Keep the window above all other windows">
              <ToggleSwitch
                checked={settings.workbench.alwaysOnTop}
                onChange={async (v) => {
                  await getCurrentWindow().setAlwaysOnTop(v);
                  updateWorkbenchSetting('alwaysOnTop', v);
                }}
                accentColor={accent.primary}
              />
            </SettingRow>

            <div style={{ marginBottom: 24, marginTop: 40 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.textWhite, marginBottom: 8 }}>Layout</h2>
              <p style={{ fontSize: 13, color: colors.textMuted }}>Customize the position of panels</p>
            </div>

            <SettingRow label="Sidebar Position" description="Position of the file explorer sidebar">
              <div style={{ display: 'flex', gap: 8 }}>
                <OptionButton
                  label="Left"
                  selected={settings.workbench.sidebarPosition === 'left'}
                  onClick={() => updateWorkbenchSetting('sidebarPosition', 'left')}
                  accentColor={accent.primary}
                />
                <OptionButton
                  label="Right"
                  selected={settings.workbench.sidebarPosition === 'right'}
                  onClick={() => updateWorkbenchSetting('sidebarPosition', 'right')}
                  accentColor={accent.primary}
                />
              </div>
            </SettingRow>

            <SettingRow label="Terminal Position" description="Position of the terminal panel">
              <div style={{ display: 'flex', gap: 8 }}>
                <OptionButton
                  label="Bottom"
                  selected={settings.workbench.terminalPosition === 'bottom'}
                  onClick={() => updateWorkbenchSetting('terminalPosition', 'bottom')}
                  accentColor={accent.primary}
                />
                <OptionButton
                  label="Top"
                  selected={settings.workbench.terminalPosition === 'top'}
                  onClick={() => updateWorkbenchSetting('terminalPosition', 'top')}
                  accentColor={accent.primary}
                />
              </div>
            </SettingRow>

            <SettingRow label="Sidebar Width" description="Default width of the sidebar in pixels">
              <NumberInput
                value={settings.workbench.sidebarWidth}
                min={160}
                max={400}
                step={10}
                onChange={(v) => updateWorkbenchSetting('sidebarWidth', v)}
                suffix="px"
                accentColor={accent.primary}
              />
            </SettingRow>
          </>
        );

      case 'quickExecute':
        return (
          <>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.textWhite, marginBottom: 8 }}>Quick Execute</h2>
              <p style={{ fontSize: 13, color: colors.textMuted }}>Floating script execution panel with keybinds</p>
            </div>

            <SettingRow label="Enable Quick Execute" description="Show floating panel for quick script execution">
              <ToggleSwitch
                checked={quickExecuteSettings.enabled}
                onChange={(v) => saveQuickExecuteSettings({ enabled: v })}
                accentColor={accent.primary}
              />
            </SettingRow>

            <SettingRow label="Toggle Menu" description="Keybind to open/close the Quick Execute menu">
              {editingKeybind === 'toggle' ? (
                <input
                  ref={keybindInputRef}
                  placeholder="Press keys..."
                  onKeyDown={(e) => handleKeybindKeyDown(e, 'toggle')}
                  onBlur={() => setEditingKeybind(null)}
                  style={{
                    width: 100,
                    background: '#1a1a1f',
                    border: `1px solid ${accent.primary}`,
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
                  onClick={() => setEditingKeybind('toggle')}
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
                  {quickExecuteSettings.toggleKeybind}
                </button>
              )}
            </SettingRow>

            <SettingRow label="Execute Script" description="Keybind to run the selected script">
              {editingKeybind === 'execute' ? (
                <input
                  ref={keybindInputRef}
                  placeholder="Press keys..."
                  onKeyDown={(e) => handleKeybindKeyDown(e, 'execute')}
                  onBlur={() => setEditingKeybind(null)}
                  style={{
                    width: 100,
                    background: '#1a1a1f',
                    border: `1px solid ${accent.primary}`,
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
                  onClick={() => setEditingKeybind('execute')}
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
                  {quickExecuteSettings.executeKeybind}
                </button>
              )}
            </SettingRow>

            <SettingRow label="Save Script" description="Keybind to save the current script">
              {editingKeybind === 'save' ? (
                <input
                  ref={keybindInputRef}
                  placeholder="Press keys..."
                  onKeyDown={(e) => handleKeybindKeyDown(e, 'save')}
                  onBlur={() => setEditingKeybind(null)}
                  style={{
                    width: 100,
                    background: '#1a1a1f',
                    border: `1px solid ${accent.primary}`,
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
                  onClick={() => setEditingKeybind('save')}
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
                  {quickExecuteSettings.saveKeybind}
                </button>
              )}
            </SettingRow>
          </>
        );

      case 'keybinds':
        const keybindActions: KeybindAction[] = [
          'newScript',
          'openFile',
          'saveScript',
          'closeTab',
          'executeScript',
          'toggleTerminal',
          'openSettings',
          'findInFile',
        ];

        return (
          <>
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.textWhite, marginBottom: 8 }}>Keyboard Shortcuts</h2>
                <p style={{ fontSize: 13, color: colors.textMuted }}>Customize keyboard shortcuts for common actions</p>
              </div>
              <button
                onClick={() => resetKeybinds()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  background: '#1f1f25',
                  border: '1px solid #2a2a35',
                  borderRadius: 6,
                  color: colors.textMuted,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={14} />
                Reset All
              </button>
            </div>

            {keybindActions.map((action) => (
              <SettingRow
                key={action}
                label={KEYBIND_LABELS[action]}
                description={KEYBIND_DESCRIPTIONS[action]}
              >
                {editingKeybind === action ? (
                  <input
                    ref={keybindInputRef}
                    placeholder="Press keys..."
                    onKeyDown={(e) => handleKeybindKeyDown(e, action)}
                    onBlur={() => setEditingKeybind(null)}
                    style={{
                      width: 120,
                      background: '#1a1a1f',
                      border: `1px solid ${accent.primary}`,
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
                    onClick={() => setEditingKeybind(action)}
                    style={{
                      background: '#1a1a1f',
                      border: '1px solid #2a2a35',
                      borderRadius: 6,
                      padding: '6px 12px',
                      color: colors.textWhite,
                      fontSize: 12,
                      cursor: 'pointer',
                      minWidth: 100,
                      textAlign: 'center',
                    }}
                  >
                    {keybindsSettings[action]}
                  </button>
                )}
              </SettingRow>
            ))}
          </>
        );

      case 'qol':
        const defaultTransforms = getDefaultTransformations();
        const allTransforms = [...defaultTransforms, ...qolSettings.userTransformations];

        return (
          <>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.textWhite, marginBottom: 8 }}>Quality of Life</h2>
              <p style={{ fontSize: 13, color: colors.textMuted }}>Auto-replace shortcuts with full code when executing scripts. Write less, do more.</p>
            </div>

            <SettingRow label="Enable QoL Replacements" description="Automatically transform shortcuts into full code when you click Run">
              <ToggleSwitch
                checked={qolSettings.enabled}
                onChange={(v) => setQolEnabled(v)}
                accentColor={accent.primary}
              />
            </SettingRow>

            <div style={{ marginBottom: 24, marginTop: 40 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.textWhite, marginBottom: 8 }}>Transformations</h2>
              <p style={{ fontSize: 13, color: colors.textMuted }}>When you type the pattern, it gets replaced with the full code on execution</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {allTransforms.map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    background: '#1a1a1f',
                    borderRadius: 8,
                    border: t.isDefault ? `1px solid ${accent.primary}30` : '1px solid #2a2a35',
                  }}
                >
                  {t.isDefault && (
                    <Lock size={14} style={{ color: accent.primary, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, display: 'flex', gap: 12, alignItems: 'center' }}>
                    <input
                      value={t.pattern}
                      onChange={(e) => !t.isDefault && updateUserTransformation(t.id, e.target.value, t.replacement)}
                      disabled={t.isDefault}
                      placeholder="Pattern"
                      style={{
                        flex: 1,
                        background: t.isDefault ? 'transparent' : '#15151a',
                        border: t.isDefault ? 'none' : '1px solid #2a2a35',
                        borderRadius: 6,
                        padding: '8px 12px',
                        color: colors.textWhite,
                        fontSize: 13,
                        fontFamily: 'monospace',
                        outline: 'none',
                      }}
                    />
                    <span style={{ color: colors.textMuted, fontSize: 12 }}>→</span>
                    <input
                      value={t.replacement}
                      onChange={(e) => !t.isDefault && updateUserTransformation(t.id, t.pattern, e.target.value)}
                      disabled={t.isDefault}
                      placeholder="Replacement"
                      style={{
                        flex: 2,
                        background: t.isDefault ? 'transparent' : '#15151a',
                        border: t.isDefault ? 'none' : '1px solid #2a2a35',
                        borderRadius: 6,
                        padding: '8px 12px',
                        color: colors.textWhite,
                        fontSize: 13,
                        fontFamily: 'monospace',
                        outline: 'none',
                      }}
                    />
                  </div>
                  {!t.isDefault && (
                    <button
                      onClick={() => removeUserTransformation(t.id)}
                      style={{
                        width: 32,
                        height: 32,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 6,
                        color: '#f87171',
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  background: '#15151a',
                  borderRadius: 8,
                  border: '1px dashed #2a2a35',
                }}
              >
                <input
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  placeholder="New pattern (e.g. noclip)"
                  style={{
                    flex: 1,
                    background: '#1a1a1f',
                    border: '1px solid #2a2a35',
                    borderRadius: 6,
                    padding: '8px 12px',
                    color: colors.textWhite,
                    fontSize: 13,
                    fontFamily: 'monospace',
                    outline: 'none',
                  }}
                />
                <span style={{ color: colors.textMuted, fontSize: 12 }}>→</span>
                <input
                  value={newReplacement}
                  onChange={(e) => setNewReplacement(e.target.value)}
                  placeholder="Replacement code"
                  style={{
                    flex: 2,
                    background: '#1a1a1f',
                    border: '1px solid #2a2a35',
                    borderRadius: 6,
                    padding: '8px 12px',
                    color: colors.textWhite,
                    fontSize: 13,
                    fontFamily: 'monospace',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={() => {
                    if (newPattern.trim() && newReplacement.trim()) {
                      addUserTransformation(newPattern.trim(), newReplacement.trim());
                      setNewPattern('');
                      setNewReplacement('');
                    }
                  }}
                  disabled={!newPattern.trim() || !newReplacement.trim()}
                  style={{
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: newPattern.trim() && newReplacement.trim() ? accent.primary : '#2a2a35',
                    border: 'none',
                    borderRadius: 6,
                    color: accent.contrastText,
                    cursor: newPattern.trim() && newReplacement.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: colors.bgDark }}>
      <div
        style={{
          width: 240,
          borderRight: '1px solid #1a1a1f',
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'transparent',
              border: 'none',
              color: colors.textMuted,
              cursor: 'pointer',
              fontSize: 13,
              padding: 0,
              marginBottom: 20,
            }}
          >
            <ArrowLeft size={16} />
            Back to Editor
          </button>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: colors.textWhite }}>Settings</h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <TabButton
            active={activeTab === 'editor'}
            onClick={() => setActiveTab('editor')}
            icon={<Code size={18} />}
            label="Editor"
            accentColor={accent.primary}
          />
          <TabButton
            active={activeTab === 'appearance'}
            onClick={() => setActiveTab('appearance')}
            icon={<Type size={18} />}
            label="Appearance"
            accentColor={accent.primary}
          />
          <TabButton
            active={activeTab === 'workbench'}
            onClick={() => setActiveTab('workbench')}
            icon={<Layout size={18} />}
            label="General"
            accentColor={accent.primary}
          />
                    <TabButton
            active={activeTab === 'quickExecute'}
            onClick={() => setActiveTab('quickExecute')}
            icon={<Zap size={18} />}
            label="Quick Execute"
            accentColor={accent.primary}
          />
          <TabButton
            active={activeTab === 'keybinds'}
            onClick={() => setActiveTab('keybinds')}
            icon={<Keyboard size={18} />}
            label="Keybinds"
            accentColor={accent.primary}
          />
          <TabButton
            active={activeTab === 'qol'}
            onClick={() => setActiveTab('qol')}
            icon={<Wand2 size={18} />}
            label="Quality of Life"
            accentColor={accent.primary}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '40px 60px' }}>
        {renderContent()}
      </div>
    </div>
  );
}
