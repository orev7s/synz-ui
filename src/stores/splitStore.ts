export type SplitDirection = 'horizontal' | 'vertical';
export type DropZone = 'top' | 'right' | 'bottom' | 'left' | 'center';
export type StartupAction = 'welcome' | 'none' | 'new';

export interface PaneTab {
  id: string;
  title: string;
  fileId?: string;
  content?: string;
  closable?: boolean;
  isDirty?: boolean;
  width?: number;
}

export interface Pane {
  id: string;
  tabs: PaneTab[];
  activeTabId: string;
}

export interface SplitNode {
  id: string;
  type: 'pane' | 'split';
  direction?: SplitDirection;
  children?: SplitNode[];
  pane?: Pane;
  ratio?: number;
}

export interface DragState {
  isDragging: boolean;
  sourcePane: string | null;
  tabId: string | null;
  tabTitle: string | null;
  mouseX: number;
  mouseY: number;
  startX: number;
  startY: number;
}

interface SplitStore {
  root: SplitNode;
  dragState: DragState;
  activePaneId: string;
}

const initialDragState: DragState = {
  isDragging: false,
  sourcePane: null,
  tabId: null,
  tabTitle: null,
  mouseX: 0,
  mouseY: 0,
  startX: 0,
  startY: 0,
};

let listeners: Set<() => void> = new Set();

function generateId(): string {
  return `pane_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

const welcomeTabId = 'welcome';

function createWelcomeTab(): PaneTab {
  return { id: welcomeTabId, title: 'Workspace', closable: true };
}

function createWelcomeTabs(): PaneTab[] {
  return [createWelcomeTab()];
}

function createInitialPane(): Pane {
  return {
    id: 'main',
    tabs: createWelcomeTabs(),
    activeTabId: welcomeTabId,
  };
}

let store: SplitStore = {
  root: {
    id: 'root',
    type: 'pane',
    pane: createInitialPane(),
  },
  dragState: { ...initialDragState },
  activePaneId: 'main',
};

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function getStore(): SplitStore {
  return store;
}

export function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function setActivePaneId(paneId: string): void {
  store = { ...store, activePaneId: paneId };
  notify();
}

export function startDrag(
  sourcePaneId: string,
  tabId: string,
  tabTitle: string,
  x: number,
  y: number
): void {
  store = {
    ...store,
    dragState: {
      isDragging: true,
      sourcePane: sourcePaneId,
      tabId,
      tabTitle,
      mouseX: x,
      mouseY: y,
      startX: x,
      startY: y,
    },
  };
  notify();
}

export function updateDragPosition(x: number, y: number): void {
  if (!store.dragState.isDragging) return;
  store = {
    ...store,
    dragState: { ...store.dragState, mouseX: x, mouseY: y },
  };
  notify();
}

export function endDrag(): void {
  store = {
    ...store,
    dragState: { ...initialDragState },
  };
  notify();
}

function findPaneInNode(node: SplitNode, paneId: string): Pane | null {
  if (node.type === 'pane' && node.pane?.id === paneId) {
    return node.pane;
  }
  if (node.children) {
    for (const child of node.children) {
      const found = findPaneInNode(child, paneId);
      if (found) return found;
    }
  }
  return null;
}

function findPane(paneId: string): Pane | null {
  return findPaneInNode(store.root, paneId);
}

function getAllPanes(node: SplitNode): Pane[] {
  if (node.type === 'pane' && node.pane) {
    return [node.pane];
  }
  if (node.children) {
    return node.children.flatMap((child) => getAllPanes(child));
  }
  return [];
}

function countPanes(node: SplitNode): number {
  if (node.type === 'pane') {
    return 1;
  }
  if (node.children) {
    return node.children.reduce((sum, child) => sum + countPanes(child), 0);
  }
  return 0;
}

export function getPane(paneId: string): Pane | null {
  return findPane(paneId);
}

export function getPanes(): Pane[] {
  return getAllPanes(store.root);
}

function updatePaneInNode(node: SplitNode, paneId: string, updater: (pane: Pane) => Pane): SplitNode {
  if (node.type === 'pane' && node.pane?.id === paneId) {
    return { ...node, pane: updater(node.pane) };
  }
  if (node.children) {
    return {
      ...node,
      children: node.children.map((child) => updatePaneInNode(child, paneId, updater)),
    };
  }
  return node;
}

export function updatePane(paneId: string, updater: (pane: Pane) => Pane): void {
  store = {
    ...store,
    root: updatePaneInNode(store.root, paneId, updater),
  };
  notify();
}

export function addTabToPane(paneId: string, tab: PaneTab): void {
  updatePane(paneId, (pane) => {
    const exists = pane.tabs.find((t) => t.id === tab.id);
    if (exists) {
      return { ...pane, activeTabId: tab.id };
    }
    return {
      ...pane,
      tabs: [...pane.tabs, tab],
      activeTabId: tab.id,
    };
  });
}

export function removeTabFromPane(paneId: string, tabId: string): void {
  const pane = findPane(paneId);
  if (!pane) return;

  const newTabs = pane.tabs.filter((t) => t.id !== tabId);
  const totalPanes = countPanes(store.root);

  if (newTabs.length === 0) {
    if (totalPanes === 1) {
      updatePane(paneId, () => ({
        ...pane,
        tabs: createWelcomeTabs(),
        activeTabId: welcomeTabId,
      }));
    } else {
      closePane(paneId);
    }
    return;
  }

  const newActiveId = pane.activeTabId === tabId ? newTabs[newTabs.length - 1].id : pane.activeTabId;
  updatePane(paneId, () => ({ ...pane, tabs: newTabs, activeTabId: newActiveId }));
}

export function setActiveTab(paneId: string, tabId: string): void {
  updatePane(paneId, (pane) => ({ ...pane, activeTabId: tabId }));
  setActivePaneId(paneId);
}

export function reorderTabs(paneId: string, tabs: PaneTab[]): void {
  updatePane(paneId, (pane) => ({ ...pane, tabs }));
}

export function closeOtherTabs(paneId: string, keepTabId: string): void {
  const pane = findPane(paneId);
  if (!pane) return;

  const keepTab = pane.tabs.find((t) => t.id === keepTabId);
  if (!keepTab) return;

  updatePane(paneId, () => ({
    ...pane,
    tabs: [keepTab],
    activeTabId: keepTabId,
  }));
}

export function closeTabsToLeft(paneId: string, tabId: string): void {
  const pane = findPane(paneId);
  if (!pane) return;

  const tabIndex = pane.tabs.findIndex((t) => t.id === tabId);
  if (tabIndex <= 0) return;

  const newTabs = pane.tabs.slice(tabIndex);
  const newActiveId = newTabs.find((t) => t.id === pane.activeTabId)?.id || tabId;

  updatePane(paneId, () => ({
    ...pane,
    tabs: newTabs,
    activeTabId: newActiveId,
  }));
}

export function closeTabsToRight(paneId: string, tabId: string): void {
  const pane = findPane(paneId);
  if (!pane) return;

  const tabIndex = pane.tabs.findIndex((t) => t.id === tabId);
  if (tabIndex === -1 || tabIndex >= pane.tabs.length - 1) return;

  const newTabs = pane.tabs.slice(0, tabIndex + 1);
  const newActiveId = newTabs.find((t) => t.id === pane.activeTabId)?.id || tabId;

  updatePane(paneId, () => ({
    ...pane,
    tabs: newTabs,
    activeTabId: newActiveId,
  }));
}

export function closeAllTabsInPane(paneId: string): void {
  const totalPanes = countPanes(store.root);

  if (totalPanes === 1) {
    updatePane(paneId, (pane) => ({
      ...pane,
      tabs: createWelcomeTabs(),
      activeTabId: welcomeTabId,
    }));
  } else {
    closePane(paneId);
  }
}

export function renameTab(paneId: string, tabId: string, newTitle: string): void {
  updatePane(paneId, (pane) => ({
    ...pane,
    tabs: pane.tabs.map((t) => (t.id === tabId ? { ...t, title: newTitle } : t)),
  }));
}

export function updateTabWidth(paneId: string, tabId: string, width: number): void {
  updatePane(paneId, (pane) => ({
    ...pane,
    tabs: pane.tabs.map((t) => (t.id === tabId ? { ...t, width } : t)),
  }));
}

export function splitPane(
  targetPaneId: string,
  direction: DropZone,
  newTab: PaneTab
): void {
  if (direction === 'center') {
    addTabToPane(targetPaneId, newTab);
    return;
  }

  const splitDir: SplitDirection = direction === 'top' || direction === 'bottom' ? 'vertical' : 'horizontal';
  const newPaneId = generateId();
  const newPane: Pane = {
    id: newPaneId,
    tabs: [newTab],
    activeTabId: newTab.id,
  };

  const newPaneNode: SplitNode = {
    id: newPaneId,
    type: 'pane',
    pane: newPane,
    ratio: 0.5,
  };

  function insertSplit(node: SplitNode): SplitNode {
    if (node.type === 'pane' && node.pane?.id === targetPaneId) {
      const existingNode = { ...node, ratio: 0.5 };
      const children = direction === 'top' || direction === 'left'
        ? [newPaneNode, existingNode]
        : [existingNode, newPaneNode];
      return {
        id: `split_${Date.now()}`,
        type: 'split',
        direction: splitDir,
        children,
      };
    }
    if (node.children) {
      return {
        ...node,
        children: node.children.map((child) => insertSplit(child)),
      };
    }
    return node;
  }

  store = {
    ...store,
    root: insertSplit(store.root),
    activePaneId: newPaneId,
  };
  notify();
}

export function moveTabToPane(
  sourcePaneId: string,
  tabId: string,
  targetPaneId: string,
  direction: DropZone
): void {
  const sourcePane = findPane(sourcePaneId);
  if (!sourcePane) return;

  const tab = sourcePane.tabs.find((t) => t.id === tabId);
  if (!tab) return;

  if (sourcePaneId === targetPaneId && direction === 'center') return;

  const sourceTabs = sourcePane.tabs.filter((t) => t.id !== tabId);
  const totalPanes = countPanes(store.root);
  const isSamePane = sourcePaneId === targetPaneId;

  if (sourceTabs.length === 0 && isSamePane && direction !== 'center') {
    updatePane(sourcePaneId, () => ({
      ...sourcePane,
      tabs: createWelcomeTabs(),
      activeTabId: welcomeTabId,
    }));
    splitPane(targetPaneId, direction, tab);
    return;
  }

  if (sourceTabs.length === 0 && !isSamePane) {
    if (direction === 'center') {
      addTabToPane(targetPaneId, tab);
      if (totalPanes > 1) {
        closePane(sourcePaneId);
      } else {
        updatePane(sourcePaneId, () => ({
          ...sourcePane,
          tabs: createWelcomeTabs(),
          activeTabId: welcomeTabId,
        }));
      }
    } else {
      splitPane(targetPaneId, direction, tab);
      if (totalPanes > 1) {
        closePane(sourcePaneId);
      } else {
        updatePane(sourcePaneId, () => ({
          ...sourcePane,
          tabs: createWelcomeTabs(),
          activeTabId: welcomeTabId,
        }));
      }
    }
  } else {
    const newActiveId = sourcePane.activeTabId === tabId && sourceTabs.length > 0
      ? sourceTabs[sourceTabs.length - 1].id
      : sourcePane.activeTabId;

    updatePane(sourcePaneId, () => ({
      ...sourcePane,
      tabs: sourceTabs,
      activeTabId: newActiveId,
    }));

    if (direction === 'center') {
      addTabToPane(targetPaneId, tab);
    } else {
      splitPane(targetPaneId, direction, tab);
    }
  }
}

export function updateTabContent(paneId: string, tabId: string, content: string, markDirty: boolean = true): void {
  updatePane(paneId, (pane) => ({
    ...pane,
    tabs: pane.tabs.map((t) => (t.id === tabId ? { ...t, content, isDirty: markDirty ? true : t.isDirty } : t)),
  }));
}

export function setTabDirty(paneId: string, tabId: string, isDirty: boolean): void {
  updatePane(paneId, (pane) => ({
    ...pane,
    tabs: pane.tabs.map((t) => (t.id === tabId ? { ...t, isDirty } : t)),
  }));
}

export function markTabClean(paneId: string, tabId: string): void {
  setTabDirty(paneId, tabId, false);
}

export function updateSplitRatio(splitId: string, ratio: number): void {
  function updateRatio(node: SplitNode): SplitNode {
    if (node.id === splitId && node.children && node.children.length === 2) {
      return {
        ...node,
        children: [
          { ...node.children[0], ratio },
          { ...node.children[1], ratio: 1 - ratio },
        ],
      };
    }
    if (node.children) {
      return { ...node, children: node.children.map(updateRatio) };
    }
    return node;
  }
  store = { ...store, root: updateRatio(store.root) };
  notify();
}

export function closePane(paneId: string): void {
  function removePane(node: SplitNode): SplitNode | null {
    if (node.type === 'pane' && node.pane?.id === paneId) {
      return null;
    }
    if (node.children) {
      const newChildren = node.children
        .map(removePane)
        .filter((n): n is SplitNode => n !== null);
      if (newChildren.length === 0) return null;
      if (newChildren.length === 1) return newChildren[0];
      return { ...node, children: newChildren };
    }
    return node;
  }

  const newRoot = removePane(store.root);
  if (newRoot) {
    const panes = getAllPanes(newRoot);
    const newActivePaneId = panes.length > 0 ? panes[0].id : 'main';
    store = {
      ...store,
      root: newRoot,
      activePaneId: newActivePaneId,
    };
    notify();
  }
}

export function removeTabFromAllPanes(tabId: string): void {
  const panes = getPanes();
  for (const pane of panes) {
    const hasTab = pane.tabs.some((t) => t.id === tabId);
    if (hasTab) {
      removeTabFromPane(pane.id, tabId);
    }
  }
}

export function updateTabInAllPanes(tabId: string, updater: (tab: PaneTab) => PaneTab): void {
  const panes = getPanes();
  for (const pane of panes) {
    const hasTab = pane.tabs.some((t) => t.id === tabId);
    if (hasTab) {
      updatePane(pane.id, (p) => ({
        ...p,
        tabs: p.tabs.map((t) => (t.id === tabId ? updater(t) : t)),
      }));
    }
  }
}

export function initializeWithStartupAction(action: StartupAction): void {
  let tabs: PaneTab[];
  let activeTabId: string;

  switch (action) {
    case 'welcome':
      tabs = [{ id: 'welcome', title: 'Workspace', closable: true }];
      activeTabId = 'welcome';
      break;
    case 'new':
      tabs = [{ id: 'new_script', title: 'script.lua', closable: true, content: '-- New Script\n' }];
      activeTabId = 'new_script';
      break;
    case 'none':
      tabs = [];
      activeTabId = '';
      break;
    default:
      tabs = [{ id: 'welcome', title: 'Workspace', closable: true }];
      activeTabId = 'welcome';
  }

  store = {
    root: {
      id: 'root',
      type: 'pane',
      pane: {
        id: 'main',
        tabs,
        activeTabId,
      },
    },
    dragState: { ...initialDragState },
    activePaneId: 'main',
  };
  notify();
}

export function restoreSession(tabs: PaneTab[], activeTabId: string): void {
  store = {
    root: {
      id: 'root',
      type: 'pane',
      pane: {
        id: 'main',
        tabs: tabs.length > 0 ? tabs : [{ id: 'welcome', title: 'Workspace', closable: true }],
        activeTabId: activeTabId || (tabs.length > 0 ? tabs[0].id : 'welcome'),
      },
    },
    dragState: { ...initialDragState },
    activePaneId: 'main',
  };
  notify();
}

export function getSessionState(): { tabs: PaneTab[]; activeTabId: string } {
  const allPanes = getAllPanes(store.root);
  const allTabs = allPanes.flatMap(p => p.tabs);
  const mainPane = findPane('main') || allPanes[0];
  return {
    tabs: allTabs,
    activeTabId: mainPane?.activeTabId || '',
  };
}
