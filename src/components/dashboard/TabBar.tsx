import { useState, useRef, useCallback, useEffect } from 'react';
import { colors } from '../../config/theme';
import { useAccentColor } from '../../hooks/useAccentColor';
import { Code, X, MoreHorizontal, Save, FilePlus, Copy, Plus } from 'lucide-react';

export interface Tab {
  id: string;
  title: string;
  icon?: React.ReactNode;
  closable?: boolean;
  isDirty?: boolean;
  width?: number;
}

const MIN_TAB_WIDTH = 100;
const MAX_TAB_WIDTH = 220;
const DEFAULT_TAB_WIDTH = 160;

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onRunClick: () => void;
  showRunButton?: boolean;
  hideRunButton?: boolean;
  paneId: string;
  onDragStart?: (paneId: string, tabId: string, tabTitle: string, x: number, y: number) => void;
  draggingTabId?: string | null;
  isActive?: boolean;
  onTabsReorder?: (tabs: Tab[]) => void;
  onCloseOthers?: (tabId: string) => void;
  onCloseToLeft?: (tabId: string) => void;
  onCloseToRight?: (tabId: string) => void;
  onCloseAll?: () => void;
  onTabRename?: (tabId: string, newTitle: string) => void;
  onSaveToFiles?: () => void;
  onNewTab?: () => void;
  onDuplicateTab?: () => void;
  isFileTab?: boolean;
  onTabWidthChange?: (tabId: string, width: number) => void;
  onNewTempTab?: () => void;
  onSeparateTab?: (tabId: string) => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  tabId: string | null;
}

interface TabItemProps {
  tab: Tab;
  isActive: boolean;
  isDragging: boolean;
  isPaneActive: boolean;
  onClick: () => void;
  onClose: () => void;
  onDragStart: (x: number, y: number) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onReorderDragStart: () => void;
  isReorderDragging: boolean;
  dragOverPosition: 'left' | 'right' | null;
  accentColor: string;
  isDirty?: boolean;
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
}

const DRAG_THRESHOLD = 8;
const SPLIT_DRAG_DELAY = 300;

function TabItem({
  tab,
  isActive,
  isDragging,
  isPaneActive,
  onClick,
  onClose,
  onDragStart,
  onContextMenu,
  onReorderDragStart,
  isReorderDragging,
  dragOverPosition,
  accentColor,
  isDirty,
  width,
  onResizeStart,
}: TabItemProps) {
  const [hovered, setHovered] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);
  const tabRef = useRef<HTMLDivElement | null>(null);
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStarted = useRef(false);
  const reorderDragStarted = useRef(false);

  const clearHoldTimer = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      mouseDownPos.current = { x: e.clientX, y: e.clientY };
      dragStarted.current = false;
      reorderDragStarted.current = false;

      holdTimer.current = setTimeout(() => {
        if (mouseDownPos.current && !reorderDragStarted.current && !dragStarted.current) {
          dragStarted.current = true;
          onDragStart(mouseDownPos.current.x, mouseDownPos.current.y);
        }
      }, SPLIT_DRAG_DELAY);

      const handleDocumentMouseMove = (moveEvent: MouseEvent) => {
        if (!mouseDownPos.current || dragStarted.current || reorderDragStarted.current) return;

        const dx = moveEvent.clientX - mouseDownPos.current.x;
        const dy = moveEvent.clientY - mouseDownPos.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > DRAG_THRESHOLD) {
          clearHoldTimer();
          const isVerticalDrag = Math.abs(dy) > Math.abs(dx) * 1.5;
          const rect = tabRef.current?.getBoundingClientRect();
          const isOutside = rect ? moveEvent.clientY < rect.top || moveEvent.clientY > rect.bottom : false;
          const shouldSplit = isVerticalDrag || isOutside;

          if (shouldSplit) {
            dragStarted.current = true;
            onDragStart(moveEvent.clientX, moveEvent.clientY);
          } else {
            reorderDragStarted.current = true;
            onReorderDragStart();
          }
        }
      };

      const handleDocumentMouseUp = () => {
        clearHoldTimer();
        if (!dragStarted.current && !reorderDragStarted.current && mouseDownPos.current) {
          onClick();
        }
        mouseDownPos.current = null;
        dragStarted.current = false;
        reorderDragStarted.current = false;
        document.removeEventListener('mousemove', handleDocumentMouseMove);
        document.removeEventListener('mouseup', handleDocumentMouseUp);
      };

      document.addEventListener('mousemove', handleDocumentMouseMove);
      document.addEventListener('mouseup', handleDocumentMouseUp);
    },
    [clearHoldTimer, onClick, onDragStart, onReorderDragStart]
  );

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
  }, []);

  useEffect(() => {
    return () => {
      clearHoldTimer();
    };
  }, [clearHoldTimer]);

  return (
    <div
      ref={tabRef}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
      onContextMenu={onContextMenu}
      style={{
        width,
        minWidth: MIN_TAB_WIDTH,
        maxWidth: MAX_TAB_WIDTH,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 14px',
        cursor: isDragging || isReorderDragging ? 'grabbing' : 'pointer',
        background: isDragging
          ? 'rgba(255,255,255,0.02)'
          : isActive
          ? `linear-gradient(135deg, ${accentColor}12 0%, ${accentColor}06 100%)`
          : hovered
          ? 'rgba(255,255,255,0.03)'
          : 'transparent',
        border: isActive && !isDragging
          ? `1px solid ${accentColor}25`
          : dragOverPosition === 'left'
          ? `1px solid ${accentColor}`
          : '1px solid transparent',
        borderRadius: 10,
        transition: isDragging || isReorderDragging ? 'none' : 'all 0.2s ease',
        opacity: isDragging || isReorderDragging ? 0.4 : 1,
        transform: isDragging || isReorderDragging ? 'scale(0.98)' : 'scale(1)',
        userSelect: 'none',
        position: 'relative',
        flexShrink: 0,
        marginRight: 6,
      }}
    >
      <div style={{
        width: 24,
        height: 24,
        borderRadius: 6,
        background: isActive ? `${accentColor}15` : hovered ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.2s ease',
      }}>
        <Code
          size={12}
          color={isDragging ? colors.textMuted : isActive && isPaneActive ? accentColor : colors.textMuted}
        />
      </div>
      <span
        style={{
          fontSize: 13,
          fontWeight: isActive ? 500 : 400,
          color: isDragging ? colors.textMuted : isActive && isPaneActive ? colors.textWhite : colors.textMuted,
          opacity: isDragging ? 0.6 : 1,
          transition: 'opacity 0.15s ease',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          minWidth: 0,
        }}
      >
        {isDirty && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: accentColor,
              flexShrink: 0,
            }}
          />
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{tab.title}</span>
      </span>
      {tab.closable !== false && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          onMouseEnter={() => setCloseHovered(true)}
          onMouseLeave={() => setCloseHovered(false)}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            background: closeHovered ? 'rgba(255,77,106,0.15)' : 'transparent',
            opacity: isDragging ? 0 : hovered || isActive ? 1 : 0,
            transition: 'all 0.15s ease',
            pointerEvents: isDragging ? 'none' : 'auto',
            flexShrink: 0,
          }}
        >
          <X size={12} color={closeHovered ? colors.error : colors.textMuted} />
        </div>
      )}
      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          onResizeStart(e);
        }}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 4,
          cursor: 'col-resize',
          background: dragOverPosition === 'right' ? accentColor : 'transparent',
          borderRadius: '0 10px 10px 0',
        }}
      />
    </div>
  );
}

export function TabBar({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onRunClick,
  showRunButton = false,
  hideRunButton = false,
  paneId,
  onDragStart,
  draggingTabId,
  isActive = true,
  onTabsReorder,
  onCloseOthers,
  onCloseToLeft,
  onCloseToRight,
  onCloseAll,
  onTabRename,
  onSaveToFiles,
  onNewTab,
  onDuplicateTab,
  isFileTab = false,
  onTabWidthChange,
  onNewTempTab,
  onSeparateTab,
}: TabBarProps) {
  const [runHovered, setRunHovered] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreButtonRef = useRef<HTMLDivElement>(null);
  const accent = useAccentColor();
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    tabId: null,
  });
  const [reorderDragState, setReorderDragState] = useState<{
    isDragging: boolean;
    tabId: string | null;
    overTabId: string | null;
    position: 'left' | 'right' | null;
  }>({
    isDragging: false,
    tabId: null,
    overTabId: null,
    position: null,
  });
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const tabRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [resizingTab, setResizingTab] = useState<{ tabId: string; startX: number; startWidth: number } | null>(null);
  const [localTabWidths, setLocalTabWidths] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
      if (moreMenuOpen) {
        setMoreMenuOpen(false);
      }
    };
    const handleCloseAll = () => {
      if (contextMenu.visible) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener('click', handleClickOutside);
    window.addEventListener('close-all-context-menus', handleCloseAll);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      window.removeEventListener('close-all-context-menus', handleCloseAll);
    };
  }, [contextMenu.visible, moreMenuOpen]);

  useEffect(() => {
    const container = tabsContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    if (!resizingTab) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizingTab.startX;
      const newWidth = Math.min(MAX_TAB_WIDTH, Math.max(MIN_TAB_WIDTH, resizingTab.startWidth + delta));
      setLocalTabWidths((prev) => new Map(prev).set(resizingTab.tabId, newWidth));
    };

    const handleMouseUp = () => {
      if (resizingTab) {
        const finalWidth = localTabWidths.get(resizingTab.tabId) ?? resizingTab.startWidth;
        onTabWidthChange?.(resizingTab.tabId, finalWidth);
      }
      setResizingTab(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingTab, localTabWidths, onTabWidthChange]);

  useEffect(() => {
    if (!reorderDragState.isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      let foundOverTab: string | null = null;
      let foundPosition: 'left' | 'right' | null = null;

      tabRefs.current.forEach((ref, tabId) => {
        if (tabId === reorderDragState.tabId) return;
        const rect = ref.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right) {
          foundOverTab = tabId;
          foundPosition = e.clientX < rect.left + rect.width / 2 ? 'left' : 'right';
        }
      });

      setReorderDragState((prev) => ({
        ...prev,
        overTabId: foundOverTab,
        position: foundPosition,
      }));
    };

    const handleMouseUp = () => {
      if (reorderDragState.tabId && reorderDragState.overTabId && reorderDragState.position) {
        const newTabs = [...tabs];
        const draggedIndex = newTabs.findIndex((t) => t.id === reorderDragState.tabId);
        const targetIndex = newTabs.findIndex((t) => t.id === reorderDragState.overTabId);

        if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
          const [draggedTab] = newTabs.splice(draggedIndex, 1);
          let insertIndex = targetIndex;
          if (draggedIndex < targetIndex) {
            insertIndex = reorderDragState.position === 'right' ? targetIndex : targetIndex - 1;
          } else {
            insertIndex = reorderDragState.position === 'right' ? targetIndex + 1 : targetIndex;
          }
          newTabs.splice(insertIndex, 0, draggedTab);
          onTabsReorder?.(newTabs);
        }
      }

      setReorderDragState({
        isDragging: false,
        tabId: null,
        overTabId: null,
        position: null,
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [reorderDragState.isDragging, reorderDragState.tabId, reorderDragState.overTabId, reorderDragState.position, tabs, onTabsReorder]);

  const handleDragStart = useCallback(
    (tabId: string, tabTitle: string) => (x: number, y: number) => {
      if (onDragStart) {
        onDragStart(paneId, tabId, tabTitle, x, y);
      }
    },
    [paneId, onDragStart]
  );

  const handleReorderDragStart = useCallback(
    (tabId: string) => () => {
      setReorderDragState({
        isDragging: true,
        tabId,
        overTabId: null,
        position: null,
      });
    },
    []
  );

  const handleResizeStart = useCallback(
    (tabId: string, currentWidth: number) => (e: React.MouseEvent) => {
      e.preventDefault();
      setResizingTab({ tabId, startX: e.clientX, startWidth: currentWidth });
    },
    []
  );

  const getTabWidth = useCallback(
    (tab: Tab) => {
      return localTabWidths.get(tab.id) ?? tab.width ?? DEFAULT_TAB_WIDTH;
    },
    [localTabWidths]
  );

  const handleContextMenu = useCallback((tabId: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(new Event('close-all-context-menus'));
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      tabId,
    });
  }, []);

  const handleCloseOthers = () => {
    if (contextMenu.tabId) {
      onCloseOthers?.(contextMenu.tabId);
    }
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleCloseToLeft = () => {
    if (contextMenu.tabId) {
      onCloseToLeft?.(contextMenu.tabId);
    }
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleCloseToRight = () => {
    if (contextMenu.tabId) {
      onCloseToRight?.(contextMenu.tabId);
    }
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleCloseAll = () => {
    onCloseAll?.();
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleSeparate = () => {
    if (contextMenu.tabId) {
      onSeparateTab?.(contextMenu.tabId);
    }
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleRenameStart = () => {
    if (contextMenu.tabId) {
      const tab = tabs.find((t) => t.id === contextMenu.tabId);
      if (tab) {
        setIsRenaming(contextMenu.tabId);
        setRenameValue(tab.title);
      }
    }
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleRenameSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isRenaming) {
      const newName = renameValue.trim();
      if (newName) {
        onTabRename?.(isRenaming, newName);
      }
      setIsRenaming(null);
      setRenameValue('');
    } else if (e.key === 'Escape') {
      setIsRenaming(null);
      setRenameValue('');
    }
  };

  const contextTabIndex = contextMenu.tabId ? tabs.findIndex((t) => t.id === contextMenu.tabId) : -1;
  const hasTabsToLeft = contextTabIndex > 0;
  const hasTabsToRight = contextTabIndex >= 0 && contextTabIndex < tabs.length - 1;

  return (
    <div
      style={{
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        background: 'linear-gradient(180deg, #0c0c10 0%, #0a0a0e 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        flexShrink: 0,
      }}
    >
      <div
        ref={tabsContainerRef}
        className="tabs-container-no-scrollbar"
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          overflowX: 'auto',
          overflowY: 'hidden',
          flex: 1,
          minWidth: 0,
          padding: '8px 0',
        }}
      >
        {tabs.map((tab) => {
          const tabWidth = getTabWidth(tab);
          return (
            <div
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el);
                else tabRefs.current.delete(tab.id);
              }}
              style={{ height: '100%', flexShrink: 0 }}
            >
              {isRenaming === tab.id ? (
                <div style={{ padding: '0 8px', height: '100%', display: 'flex', alignItems: 'center', width: tabWidth }}>
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={handleRenameSubmit}
                    onBlur={() => {
                      setIsRenaming(null);
                      setRenameValue('');
                    }}
                    autoFocus
                    style={{
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${accent.primary}40`,
                      borderRadius: 8,
                      outline: 'none',
                      fontSize: 13,
                      color: colors.textWhite,
                      width: '100%',
                    }}
                  />
                </div>
              ) : (
                <TabItem
                  tab={tab}
                  isActive={activeTabId === tab.id}
                  isDragging={draggingTabId === tab.id}
                  isPaneActive={isActive}
                  onClick={() => onTabClick(tab.id)}
                  onClose={() => onTabClose(tab.id)}
                  onDragStart={handleDragStart(tab.id, tab.title)}
                  onContextMenu={handleContextMenu(tab.id)}
                  onReorderDragStart={handleReorderDragStart(tab.id)}
                  isReorderDragging={reorderDragState.isDragging && reorderDragState.tabId === tab.id}
                  dragOverPosition={
                    reorderDragState.overTabId === tab.id ? reorderDragState.position : null
                  }
                  accentColor={accent.primary}
                  isDirty={tab.isDirty}
                  width={tabWidth}
                  onResizeStart={handleResizeStart(tab.id, tabWidth)}
                />
              )}
            </div>
          );
        })}
        {onNewTempTab && (
          <div
            onClick={onNewTempTab}
            style={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              cursor: 'pointer',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid transparent',
              transition: 'all 0.15s ease',
              flexShrink: 0,
              marginLeft: 4,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              e.currentTarget.style.border = `1px solid ${accent.primary}30`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
              e.currentTarget.style.border = '1px solid transparent';
            }}
          >
            <Plus size={14} color={colors.textMuted} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px', flexShrink: 0 }}>
        {showRunButton && !hideRunButton && (
          <div
            onClick={onRunClick}
            onMouseEnter={() => setRunHovered(true)}
            onMouseLeave={() => setRunHovered(false)}
            style={{
              width: 36,
              height: 36,
              background: runHovered
                ? `linear-gradient(135deg, ${accent.primary}20 0%, ${accent.primary}10 100%)`
                : 'rgba(255,255,255,0.02)',
              borderRadius: 10,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: runHovered ? `1px solid ${accent.primary}30` : '1px solid transparent',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 2L12 7L3 12V2Z"
                fill={runHovered ? accent.primary : colors.textMuted}
                style={{ transition: 'fill 0.15s ease' }}
              />
            </svg>
          </div>
        )}

        <div ref={moreButtonRef} style={{ position: 'relative' }}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              setMoreMenuOpen(!moreMenuOpen);
            }}
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
              cursor: 'pointer',
              background: moreMenuOpen ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = moreMenuOpen ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)')
            }
          >
            <MoreHorizontal size={16} color={moreMenuOpen ? colors.textWhite : colors.textMuted} />
          </div>

          {moreMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 8,
                background: '#141418',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                padding: '6px',
                zIndex: 10000,
                minWidth: 180,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {onNewTab && (
                <div
                  onClick={() => {
                    onNewTab();
                    setMoreMenuOpen(false);
                  }}
                  style={{
                    padding: '10px 14px',
                    fontSize: 13,
                    color: colors.textWhite,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderRadius: 8,
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <FilePlus size={16} color={colors.textMuted} />
                  New Script
                </div>
              )}
              {isFileTab && onSaveToFiles && (
                <div
                  onClick={() => {
                    onSaveToFiles();
                    setMoreMenuOpen(false);
                  }}
                  style={{
                    padding: '10px 14px',
                    fontSize: 13,
                    color: colors.textWhite,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderRadius: 8,
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Save size={16} color={colors.textMuted} />
                  Save to Files
                </div>
              )}
              {isFileTab && onDuplicateTab && (
                <div
                  onClick={() => {
                    onDuplicateTab();
                    setMoreMenuOpen(false);
                  }}
                  style={{
                    padding: '10px 14px',
                    fontSize: 13,
                    color: colors.textWhite,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderRadius: 8,
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Copy size={16} color={colors.textMuted} />
                  Duplicate Script
                </div>
              )}
              {!onNewTab && !isFileTab && (
                <div
                  style={{
                    padding: '10px 14px',
                    fontSize: 13,
                    color: colors.textMuted,
                  }}
                >
                  No actions available
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {contextMenu.visible && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#141418',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: '6px',
            zIndex: 10000,
            minWidth: 160,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {onTabRename && (
            <div
              onClick={handleRenameStart}
              style={{
                padding: '10px 14px',
                fontSize: 13,
                color: colors.textWhite,
                cursor: 'pointer',
                borderRadius: 8,
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              Rename
            </div>
          )}
          {onSeparateTab && (
            <div
              onClick={handleSeparate}
              style={{
                padding: '10px 14px',
                fontSize: 13,
                color: colors.textWhite,
                cursor: 'pointer',
                borderRadius: 8,
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              Separate
            </div>
          )}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
          <div
            onClick={() => {
              if (contextMenu.tabId) onTabClose(contextMenu.tabId);
              setContextMenu((prev) => ({ ...prev, visible: false }));
            }}
            style={{
              padding: '10px 14px',
              fontSize: 13,
              color: colors.textWhite,
              cursor: 'pointer',
              borderRadius: 8,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Close
          </div>
          {onCloseOthers && tabs.length > 1 && (
            <div
              onClick={handleCloseOthers}
              style={{
                padding: '10px 14px',
                fontSize: 13,
                color: colors.textWhite,
                cursor: 'pointer',
                borderRadius: 8,
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              Close Others
            </div>
          )}
          {onCloseToLeft && hasTabsToLeft && (
            <div
              onClick={handleCloseToLeft}
              style={{
                padding: '10px 14px',
                fontSize: 13,
                color: colors.textWhite,
                cursor: 'pointer',
                borderRadius: 8,
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              Close to the Left
            </div>
          )}
          {onCloseToRight && hasTabsToRight && (
            <div
              onClick={handleCloseToRight}
              style={{
                padding: '10px 14px',
                fontSize: 13,
                color: colors.textWhite,
                cursor: 'pointer',
                borderRadius: 8,
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              Close to the Right
            </div>
          )}
          {onCloseAll && tabs.length > 1 && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
              <div
                onClick={handleCloseAll}
                style={{
                  padding: '10px 14px',
                  fontSize: 13,
                  color: colors.error,
                  cursor: 'pointer',
                  borderRadius: 8,
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,77,106,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Close All
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
