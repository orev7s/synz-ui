import { useState, useCallback, useEffect, useSyncExternalStore, useRef, useMemo } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { colors } from '../../config/theme';
import { useKeybinds } from '../../hooks/useKeybinds';
import { Sidebar } from './Sidebar';
import { TabBar, Tab } from './TabBar';
import { WelcomePage } from './WelcomePage';
import { TerminalPanel } from './TerminalPanel';
import { StatusBar } from './StatusBar';
import { SplitContainer } from './SplitContainer';
import { DropZoneOverlay } from './DropZoneOverlay';
import { DragGhost } from './DragGhost';
import { SettingsPage } from './SettingsPage';
import { AccountPage } from './AccountPage';
import { ScriptHub } from './ScriptHub';
import { FloatingExecuteButton } from './FloatingExecuteButton';
import { QuickFilePicker } from './QuickFilePicker';
import { ClientManagerDialog } from './ClientManagerDialog';
import { CodeEditor } from '../../editor';
import { fileStore } from '../../stores/fileStore';
import { loadSettings, getSettings, subscribeToSettings, WorkbenchSettings, updateWorkbenchSetting } from '../../stores/settingsStore';
import { saveSession, loadSession } from '../../stores/sessionStore';
import { executeScript } from '../../stores/attachStore';
import { transformScript, loadQolSettings } from '../../stores/qolStore';
import { loadClientManager } from '../../stores/clientManagerStore';
import {
  getStore,
  subscribe,
  startDrag,
  updateDragPosition,
  endDrag,
  setActiveTab,
  removeTabFromPane,
  addTabToPane,
  moveTabToPane,
  updateTabContent,
  setActivePaneId,
  getPane,
  reorderTabs,
  closeOtherTabs,
  closeTabsToLeft,
  closeTabsToRight,
  closeAllTabsInPane,
  renameTab,
  removeTabFromAllPanes,
  initializeWithStartupAction,
  restoreSession,
  getSessionState,
  markTabClean,
  updateTabWidth,
  splitPane,
  DropZone,
  PaneTab,
} from '../../stores/splitStore';
import synapseIcon from '../../assets/icon.png';
import { Minus, Square, X } from 'lucide-react';

interface WindowButtonProps {
  onClick: () => void;
  tooltip: string;
  children: React.ReactNode;
  isClose?: boolean;
}

function WindowButton({ onClick, tooltip, children, isClose }: WindowButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onClick}
        onMouseEnter={() => {
          setHovered(true);
          setTimeout(() => setShowTooltip(true), 400);
        }}
        onMouseLeave={() => {
          setHovered(false);
          setShowTooltip(false);
        }}
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          background: hovered ? (isClose ? '#FF4D6A' : '#18181d') : 'transparent',
          color: hovered && isClose ? '#FFF' : colors.textMuted,
          cursor: 'pointer',
          borderRadius: 6,
          transition: 'all 0.15s ease',
        }}
      >
        {children}
      </button>
      {showTooltip && hovered && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: 6,
            padding: '4px 8px',
            background: '#18181d',
            color: colors.textWhite,
            fontSize: 11,
            borderRadius: 4,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            border: '1px solid #1a1a1f',
            zIndex: 1000,
          }}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}

export function Dashboard() {
  const appWindow = getCurrentWindow();
  const store = useSyncExternalStore(subscribe, getStore);
  const [activeView, setActiveView] = useState<'editor' | 'settings' | 'account'>('editor');
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(180);
  const [workbenchSettings, setWorkbenchSettings] = useState<WorkbenchSettings>({ startupAction: 'welcome', restoreTabs: false, floatingExecuteButton: false, sidebarPosition: 'left', terminalPosition: 'bottom', sidebarWidth: 220, alwaysOnTop: false });
  const [quickFilePickerOpen, setQuickFilePickerOpen] = useState(false);
  const [clientManagerOpen, setClientManagerOpen] = useState(false);
  const initializedRef = useRef(false);
  const restoreTabsRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    loadQolSettings();
    loadClientManager();

    loadSettings().then(async () => {
      const settings = getSettings();
      const action = settings.workbench.startupAction;
      restoreTabsRef.current = settings.workbench.restoreTabs;
      setWorkbenchSettings(settings.workbench);

      if (settings.workbench.alwaysOnTop) {
        appWindow.setAlwaysOnTop(true);
      }

      if (settings.workbench.restoreTabs) {
        const session = await loadSession();
        if (session && session.tabs.length > 0) {
          restoreSession(session.tabs, session.activeTabId);
          return;
        }
      }

      if (action === 'new') {
        const file = await fileStore.createFile('script.lua', '-- New Script\n');
        const tabId = `file_${file.id}`;
        const newTab: PaneTab = {
          id: tabId,
          title: file.name,
          fileId: file.id,
          content: file.content,
          closable: true,
        };
        initializeWithStartupAction('none');
        addTabToPane('main', newTab);
      } else {
        initializeWithStartupAction(action);
      }
    });
  }, []);

  useEffect(() => {
    const unsubscribeSettings = subscribeToSettings(() => {
      const settings = getSettings();
      restoreTabsRef.current = settings.workbench.restoreTabs;
      setWorkbenchSettings(settings.workbench);
    });
    return unsubscribeSettings;
  }, []);

  useEffect(() => {
    if (!restoreTabsRef.current) return;
    const { tabs, activeTabId } = getSessionState();
    if (tabs.length > 0) {
      saveSession(tabs, activeTabId);
    }
  }, [store.root]);

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();

  const handleBackToEditor = () => setActiveView('editor');

  const handleScriptHubExecute = useCallback(async (script: string) => {
    if (!script.trim()) return;
    await executeScript(transformScript(script));
  }, []);

  const handleScriptHubOpen = useCallback(() => {
    const tabId = 'scripthub';
    const newTab: PaneTab = {
      id: tabId,
      title: 'Script Hub',
      closable: true,
    };
    addTabToPane(store.activePaneId, newTab);
  }, [store.activePaneId]);

  const handleDragStart = useCallback(
    (paneId: string, tabId: string, tabTitle: string, x: number, y: number) => {
      startDrag(paneId, tabId, tabTitle, x, y);
    },
    []
  );

  useEffect(() => {
    if (!store.dragState.isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateDragPosition(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
      endDrag();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [store.dragState.isDragging]);

  const handleDrop = useCallback(
    (targetPaneId: string) => (zone: DropZone) => {
      const { sourcePane, tabId } = store.dragState;
      if (!sourcePane || !tabId) return;
      moveTabToPane(sourcePane, tabId, targetPaneId, zone);
      endDrag();
    },
    [store.dragState]
  );

  const openFileInPane = useCallback((fileId: string, fileName: string) => {
    const file = fileStore.getFile(fileId);
    const tabId = `file_${fileId}`;
    const newTab: PaneTab = {
      id: tabId,
      title: fileName,
      fileId,
      content: file?.content ?? '',
      closable: true,
    };
    addTabToPane(store.activePaneId, newTab);
  }, [store.activePaneId]);

  const openTabInPane = useCallback((tabId: string, title: string) => {
    const newTab: PaneTab = {
      id: tabId,
      title,
      closable: true,
    };
    addTabToPane(store.activePaneId, newTab);
  }, [store.activePaneId]);

  const handleContentChange = useCallback(
    (paneId: string, tabId: string) => (newContent: string) => {
      updateTabContent(paneId, tabId, newContent, true);
    },
    []
  );

  const handleFileDelete = useCallback((fileId: string) => {
    const tabId = `file_${fileId}`;
    removeTabFromAllPanes(tabId);
  }, []);

  const handleTabsReorder = useCallback((paneId: string) => (tabs: Tab[]) => {
    const paneTabs: PaneTab[] = tabs.map((t) => {
      const pane = getPane(paneId);
      const existingTab = pane?.tabs.find((pt) => pt.id === t.id);
      return existingTab || { id: t.id, title: t.title, closable: t.closable };
    });
    reorderTabs(paneId, paneTabs);
  }, []);

  const handleCloseOthers = useCallback((paneId: string) => (tabId: string) => {
    closeOtherTabs(paneId, tabId);
  }, []);

  const handleCloseToLeft = useCallback((paneId: string) => (tabId: string) => {
    closeTabsToLeft(paneId, tabId);
  }, []);

  const handleCloseToRight = useCallback((paneId: string) => (tabId: string) => {
    closeTabsToRight(paneId, tabId);
  }, []);

  const handleCloseAll = useCallback((paneId: string) => () => {
    closeAllTabsInPane(paneId);
  }, []);

  const handleTabRename = useCallback((paneId: string) => async (tabId: string, newTitle: string) => {
    const pane = getPane(paneId);
    if (!pane) return;

    const tab = pane.tabs.find((t) => t.id === tabId);
    if (!tab) return;

    if (tab.fileId) {
      const finalName = newTitle.endsWith('.lua') || newTitle.endsWith('.luau') ? newTitle : `${newTitle}.lua`;
      const existingFile = fileStore.getFileByName(finalName);
      if (!existingFile || existingFile.id === tab.fileId) {
        await fileStore.renameFile(tab.fileId, finalName);
        renameTab(paneId, tabId, finalName);
      }
    } else {
      renameTab(paneId, tabId, newTitle);
    }
  }, []);

  const handleTabWidthChange = useCallback((paneId: string) => (tabId: string, width: number) => {
    updateTabWidth(paneId, tabId, width);
  }, []);

  const handleNewTab = useCallback((paneId: string) => async () => {
    const baseName = 'script';
    let counter = 1;
    let newName = `${baseName}.lua`;

    while (fileStore.getFileByName(newName)) {
      counter++;
      newName = `${baseName}${counter}.lua`;
    }

    const file = await fileStore.createFile(newName, '-- New Script\n');
    const tabId = `file_${file.id}`;
    const newTab: PaneTab = {
      id: tabId,
      title: file.name,
      fileId: file.id,
      content: file.content,
      closable: true,
    };
    addTabToPane(paneId, newTab);
  }, []);

  const handleSaveToFiles = useCallback((paneId: string) => async () => {
    const pane = getPane(paneId);
    if (!pane) return;
    const tab = pane.tabs.find((t) => t.id === pane.activeTabId);
    if (tab?.fileId) {
      await fileStore.updateFile(tab.fileId, tab.content || '');
      markTabClean(paneId, tab.id);
    }
  }, []);

  const handleSeparateTab = useCallback((paneId: string) => (tabId: string) => {
    const pane = getPane(paneId);
    if (!pane) return;
    const tab = pane.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    removeTabFromPane(paneId, tabId);
    splitPane(paneId, 'right', tab);
  }, []);

  const handleRevealInExplorer = useCallback((fileId: string) => {
    fileStore.revealInExplorer(fileId);
  }, []);

  const handleNewTempTab = useCallback((paneId: string) => () => {
    const tabId = `temp_${Date.now()}`;
    const newTab: PaneTab = {
      id: tabId,
      title: 'Untitled',
      content: '',
      closable: true,
    };
    addTabToPane(paneId, newTab);
  }, []);

  const handleDuplicateTab = useCallback((paneId: string) => async () => {
    const pane = getPane(paneId);
    if (!pane) return;
    const tab = pane.tabs.find((t) => t.id === pane.activeTabId);
    if (!tab?.fileId) return;

    const originalFile = fileStore.getFile(tab.fileId);
    if (!originalFile) return;

    const baseName = originalFile.name.replace(/\.(lua|luau)$/, '');
    let counter = 1;
    let newName = `${baseName}_copy.lua`;

    while (fileStore.getFileByName(newName)) {
      counter++;
      newName = `${baseName}_copy${counter}.lua`;
    }

    const newFile = await fileStore.createFile(newName, originalFile.content);
    const newTabId = `file_${newFile.id}`;
    const newTab: PaneTab = {
      id: newTabId,
      title: newFile.name,
      fileId: newFile.id,
      content: newFile.content,
      closable: true,
    };
    addTabToPane(paneId, newTab);
  }, []);

  const handleExecuteScript = useCallback((paneId: string) => async () => {
    const pane = getPane(paneId);
    if (!pane) return;
    const tab = pane.tabs.find((t) => t.id === pane.activeTabId);
    if (!tab) return;
    const content = tab.content || '';
    if (!content.trim()) return;
    await executeScript(transformScript(content));
  }, []);

  const handleFloatingExecute = useCallback(async () => {
    const pane = getPane(store.activePaneId);
    if (!pane) return;
    const tab = pane.tabs.find((t) => t.id === pane.activeTabId);
    if (!tab) return;
    const content = tab.content || '';
    if (!content.trim()) return;
    await executeScript(transformScript(content));
  }, [store.activePaneId]);

  const handleKeybindNewScript = useCallback(async () => {
    const baseName = 'script';
    let counter = 1;
    let newName = `${baseName}.lua`;
    while (fileStore.getFileByName(newName)) {
      counter++;
      newName = `${baseName}${counter}.lua`;
    }
    const file = await fileStore.createFile(newName, '-- New Script\n');
    const tabId = `file_${file.id}`;
    const newTab: PaneTab = {
      id: tabId,
      title: file.name,
      fileId: file.id,
      content: file.content,
      closable: true,
    };
    addTabToPane(store.activePaneId, newTab);
  }, [store.activePaneId]);

  const handleKeybindSaveScript = useCallback(async () => {
    const pane = getPane(store.activePaneId);
    if (!pane) return;
    const tab = pane.tabs.find((t) => t.id === pane.activeTabId);
    if (tab?.fileId && tab.isDirty) {
      await fileStore.updateFile(tab.fileId, tab.content || '');
      markTabClean(store.activePaneId, tab.id);
    }
  }, [store.activePaneId]);

  const handleKeybindCloseTab = useCallback(() => {
    const pane = getPane(store.activePaneId);
    if (!pane || !pane.activeTabId) return;
    const tab = pane.tabs.find((t) => t.id === pane.activeTabId);
    if (tab?.closable !== false) {
      removeTabFromPane(store.activePaneId, pane.activeTabId);
    }
  }, [store.activePaneId]);

  const handleKeybindExecuteScript = useCallback(async () => {
    const pane = getPane(store.activePaneId);
    if (!pane) return;
    const tab = pane.tabs.find((t) => t.id === pane.activeTabId);
    if (!tab || !tab.fileId) return;
    const content = tab.content || '';
    if (!content.trim()) return;
    await executeScript(transformScript(content));
  }, [store.activePaneId]);

  const handleKeybindToggleTerminal = useCallback(() => {
    setTerminalOpen((prev) => !prev);
  }, []);

  const handleKeybindOpenSettings = useCallback(() => {
    setActiveView('settings');
  }, []);

  const handleKeybindQuickFilePicker = useCallback(() => {
    setQuickFilePickerOpen(true);
  }, []);

  const handleKeybindOpenFile = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [
        { name: 'Lua Scripts', extensions: ['lua', 'luau'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (!selected) return;

    const filePath = typeof selected === 'string' ? selected : selected;
    const content = await readTextFile(filePath);
    const fileName = filePath.split(/[/\\]/).pop() || 'untitled.lua';
    const tabId = `external_${Date.now()}`;

    const newTab: PaneTab = {
      id: tabId,
      title: fileName,
      content,
      closable: true,
      isDirty: false,
    };
    addTabToPane(store.activePaneId, newTab);
  }, [store.activePaneId]);

  const keybindHandlers = useMemo(
    () => ({
      onNewScript: handleKeybindNewScript,
      onOpenFile: handleKeybindOpenFile,
      onSaveScript: handleKeybindSaveScript,
      onCloseTab: handleKeybindCloseTab,
      onExecuteScript: handleKeybindExecuteScript,
      onToggleTerminal: handleKeybindToggleTerminal,
      onOpenSettings: handleKeybindOpenSettings,
      onQuickFilePicker: handleKeybindQuickFilePicker,
    }),
    [
      handleKeybindNewScript,
      handleKeybindOpenFile,
      handleKeybindSaveScript,
      handleKeybindCloseTab,
      handleKeybindExecuteScript,
      handleKeybindToggleTerminal,
      handleKeybindOpenSettings,
      handleKeybindQuickFilePicker,
    ]
  );

  useKeybinds(keybindHandlers, activeView === 'editor');

  const renderPaneContent = useCallback(
    (paneId: string) => {
      const pane = getPane(paneId);
      if (!pane) return null;

      const activeTab = pane.tabs.find((t) => t.id === pane.activeTabId);
      const isFileTab = activeTab?.fileId !== undefined;
      const isCodeTab = isFileTab || activeTab?.content !== undefined;
      const isPaneActive = store.activePaneId === paneId;

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            position: 'relative',
          boxShadow: isPaneActive ? 'inset 0 0 0 1px rgba(255,255,255,0.06)' : 'none',
          borderRadius: 4,
          transition: 'box-shadow 0.15s ease',
          }}
          onClick={() => setActivePaneId(paneId)}
        >
          <TabBar
            tabs={pane.tabs}
            activeTabId={pane.activeTabId}
            onTabClick={(tabId) => setActiveTab(paneId, tabId)}
            onTabClose={(tabId) => removeTabFromPane(paneId, tabId)}
            onRunClick={handleExecuteScript(paneId)}
            showRunButton={isCodeTab}
            hideRunButton={workbenchSettings.floatingExecuteButton}
            paneId={paneId}
            onDragStart={handleDragStart}
            draggingTabId={store.dragState.sourcePane === paneId ? store.dragState.tabId : null}
            isActive={isPaneActive}
            onTabsReorder={handleTabsReorder(paneId)}
            onCloseOthers={handleCloseOthers(paneId)}
            onCloseToLeft={handleCloseToLeft(paneId)}
            onCloseToRight={handleCloseToRight(paneId)}
            onCloseAll={handleCloseAll(paneId)}
            onTabRename={handleTabRename(paneId)}
            onSaveToFiles={handleSaveToFiles(paneId)}
            onNewTab={handleNewTab(paneId)}
            onDuplicateTab={handleDuplicateTab(paneId)}
            isFileTab={isCodeTab}
            onTabWidthChange={handleTabWidthChange(paneId)}
            onNewTempTab={handleNewTempTab(paneId)}
            onSeparateTab={handleSeparateTab(paneId)}
          />

          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            {pane.activeTabId === 'welcome' && (
              <WelcomePage
                onToggleTerminal={() => setTerminalOpen(!terminalOpen)}
                onOpenSettings={() => setActiveView('settings')}
                onOpenFile={openFileInPane}
                onNewFile={handleNewTab(paneId)}
              />
            )}
            {pane.activeTabId === 'scripthub' && (
              <ScriptHub onExecuteScript={handleScriptHubExecute} />
            )}
            {isCodeTab && activeTab && (
              <CodeEditor
                value={activeTab.content || ''}
                onChange={handleContentChange(paneId, activeTab.id)}
                fileId={activeTab.fileId || activeTab.id}
                fileName={activeTab.title}
              />
            )}

            <DropZoneOverlay
              isDragging={store.dragState.isDragging}
              onDrop={handleDrop(paneId)}
            />
          </div>
        </div>
      );
    },
    [
      store.activePaneId,
      store.dragState,
      terminalOpen,
      handleDragStart,
      handleContentChange,
      handleDrop,
      openTabInPane,
      handleTabsReorder,
      handleCloseOthers,
      handleCloseToLeft,
      handleCloseToRight,
      handleCloseAll,
      handleTabRename,
      handleNewTab,
      handleSaveToFiles,
      handleDuplicateTab,
      handleExecuteScript,
      handleScriptHubExecute,
      handleTabWidthChange,
      handleNewTempTab,
      handleSeparateTab,
    ]
  );

  const activePane = getPane(store.activePaneId);
  const activeTab = activePane?.tabs.find((t) => t.id === activePane.activeTabId);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: colors.bgDark,
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      <div
        data-tauri-drag-region
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          background: '#0d0d11',
          borderBottom: '1px solid #1a1a1f',
          userSelect: 'none',
        }}
      >
        <div
          data-tauri-drag-region
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <img
            src={synapseIcon}
            alt="Synapse Z"
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              cursor: activeView !== 'editor' ? 'pointer' : 'default',
            }}
            onClick={activeView !== 'editor' ? handleBackToEditor : undefined}
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: colors.textMuted,
            }}
          >
            {activeView === 'settings' ? 'Settings' : activeView === 'account' ? 'Account' : 'Synapse Z'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          <WindowButton onClick={handleMinimize} tooltip="Minimize">
            <Minus size={12} />
          </WindowButton>

          <WindowButton onClick={handleMaximize} tooltip="Maximize">
            <Square size={10} />
          </WindowButton>

          <WindowButton onClick={handleClose} tooltip="Close" isClose>
            <X size={12} />
          </WindowButton>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {activeView === 'editor' ? (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <Sidebar
              activeTab={activeTab?.title || 'Welcome'}
              onFileOpen={openFileInPane}
              onFileDelete={handleFileDelete}
              onSettingsClick={() => setActiveView('settings')}
              onAccountClick={() => setActiveView('account')}
              onScriptHubClick={handleScriptHubOpen}
              onClientManagerClick={() => setClientManagerOpen(true)}
              onRevealInExplorer={handleRevealInExplorer}
              width={workbenchSettings.sidebarWidth}
              onWidthChange={(w) => updateWorkbenchSetting('sidebarWidth', w)}
              position={workbenchSettings.sidebarPosition}
              order={workbenchSettings.sidebarPosition === 'left' ? 0 : 2}
            />

            <div style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              overflow: 'hidden',
              order: 1,
            }}>
              <TerminalPanel
                isOpen={terminalOpen}
                onToggle={() => setTerminalOpen(!terminalOpen)}
                height={terminalHeight}
                onHeightChange={setTerminalHeight}
                position={workbenchSettings.terminalPosition}
                order={workbenchSettings.terminalPosition === 'top' ? 0 : 2}
              />

              <div style={{ flex: 1, overflow: 'hidden', order: 1 }}>
                <SplitContainer node={store.root} renderPane={renderPaneContent} />
              </div>
            </div>
          </div>
        ) : activeView === 'account' ? (
          <AccountPage onBack={handleBackToEditor} />
        ) : (
          <SettingsPage onBack={handleBackToEditor} />
        )}
      </div>

      {activeView === 'editor' && <StatusBar />}

      {store.dragState.isDragging && store.dragState.tabTitle && (
        <DragGhost
          title={store.dragState.tabTitle}
          x={store.dragState.mouseX}
          y={store.dragState.mouseY}
        />
      )}

      {activeView === 'editor' && workbenchSettings.floatingExecuteButton && (
        <FloatingExecuteButton onExecute={handleFloatingExecute} />
      )}

      <QuickFilePicker
        isOpen={quickFilePickerOpen}
        onClose={() => setQuickFilePickerOpen(false)}
        onFileSelect={openFileInPane}
      />

      <ClientManagerDialog
        isOpen={clientManagerOpen}
        onClose={() => setClientManagerOpen(false)}
      />
    </div>
  );
}
