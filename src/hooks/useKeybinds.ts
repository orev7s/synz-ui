import { useEffect, useState, useCallback } from 'react';
import {
  getKeybinds,
  loadKeybinds,
  subscribeToKeybinds,
  matchesKeybind,
  KeybindsSettings,
  KeybindAction,
} from '../stores/keybindsStore';

export interface KeybindHandlers {
  onNewScript?: () => void;
  onOpenFile?: () => void;
  onSaveScript?: () => void;
  onCloseTab?: () => void;
  onExecuteScript?: () => void;
  onToggleTerminal?: () => void;
  onOpenSettings?: () => void;
  onQuickFilePicker?: () => void;
  onOpenExplorer?: () => void;
}

export function useKeybinds(handlers: KeybindHandlers, enabled: boolean = true): KeybindsSettings {
  const [keybinds, setKeybinds] = useState<KeybindsSettings>(getKeybinds());

  useEffect(() => {
    loadKeybinds();
    const unsubscribe = subscribeToKeybinds(() => {
      setKeybinds(getKeybinds());
    });
    return unsubscribe;
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const target = event.target as HTMLElement;
      const isInInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      const actionMap: Partial<Record<KeybindAction, (() => void) | undefined>> = {
        newScript: handlers.onNewScript,
        openFile: handlers.onOpenFile,
        saveScript: handlers.onSaveScript,
        closeTab: handlers.onCloseTab,
        executeScript: handlers.onExecuteScript,
        toggleTerminal: handlers.onToggleTerminal,
        openSettings: handlers.onOpenSettings,
        quickFilePicker: handlers.onQuickFilePicker,
        openExplorer: handlers.onOpenExplorer,
      };

      const actions: KeybindAction[] = [
        'newScript',
        'openFile',
        'saveScript',
        'closeTab',
        'executeScript',
        'toggleTerminal',
        'openSettings',
        'quickFilePicker',
        'openExplorer',
      ];

      for (const action of actions) {
        const keybind = keybinds[action];
        if (matchesKeybind(event, keybind)) {
          if (isInInput && !['executeScript', 'toggleTerminal', 'openSettings', 'saveScript', 'quickFilePicker', 'openExplorer'].includes(action)) {
            return;
          }

          const handler = actionMap[action];
          if (handler) {
            event.preventDefault();
            event.stopPropagation();
            handler();
          }
          return;
        }
      }
    },
    [enabled, keybinds, handlers]
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown, enabled]);

  return keybinds;
}
