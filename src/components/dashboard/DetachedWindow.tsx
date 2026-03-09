import { useState, useEffect, useRef, useCallback } from 'react';
import { getCurrentWindow, PhysicalPosition } from '@tauri-apps/api/window';
import { emit } from '@tauri-apps/api/event';
import { colors } from '../../config/theme';
import { useAccentColor } from '../../hooks/useAccentColor';
import { CodeEditor } from '../../editor';
import { ExplorerPanel } from './Explorer/ExplorerPanel';
import { fileStore, initializeFileStore, subscribeToFileStore } from '../../stores/fileStore';
import { checkMainWindowAndClose } from '../../stores/detachedWindowStore';
import { transformScript, loadQolSettings } from '../../stores/qolStore';
import { initializeExplorerStore } from '../../stores/explorerStore';
import { executeScript } from '../../stores/attachStore';
import { X, Minus } from 'lucide-react';
import '../../styles/globals.css';

interface DetachedWindowProps {
  tabId: string;
  tabType: 'editor' | 'explorer' | 'scripthub' | 'settings';
  tabTitle: string;
  fileId?: string;
  sourcePaneId: string;
  contentKey?: string;
}

export function DetachedWindow({ tabId, tabType, tabTitle, fileId, sourcePaneId, contentKey }: DetachedWindowProps) {
  useAccentColor();
  const [isDragging, setIsDragging] = useState(false);
  const [content, setContent] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const windowPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
    const root = document.getElementById('root');
    if (root) root.style.background = 'transparent';
  }, []);

  useEffect(() => {
    loadQolSettings();
    if (tabType === 'explorer') {
      initializeExplorerStore();
    }
  }, [tabType]);

  useEffect(() => {
    const init = async () => {
      await initializeFileStore();

      if (contentKey) {
        try {
          const savedContent = localStorage.getItem(contentKey);
          if (savedContent !== null) {
            setContent(savedContent);
            localStorage.removeItem(contentKey);
            setIsInitialized(true);
            return;
          }
        } catch {}
      }

      if (tabType === 'editor' && fileId) {
        const file = fileStore.getFile(fileId);
        if (file) {
          setContent(file.content);
        }
      }
      setIsInitialized(true);
    };
    init();

    const unsubscribe = subscribeToFileStore(() => {
      if (tabType === 'editor' && fileId && !isInitialized) {
        const file = fileStore.getFile(fileId);
        if (file) {
          setContent(file.content);
        }
      }
    });

    return unsubscribe;
  }, [tabType, fileId, contentKey, isInitialized]);

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
    const interval = window.setInterval(checkMainWindowAndClose, 500);
    return () => clearInterval(interval);
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

  const handleClose = async () => {
    const win = getCurrentWindow();

    await emit('detached-window-closing', {
      windowLabel: win.label,
      tabId,
      tabType,
      tabTitle,
      fileId,
      content,
      sourcePaneId,
    });

    setTimeout(async () => {
      try {
        await win.close();
      } catch {
        await win.destroy();
      }
    }, 50);
  };

  const handleMinimize = async () => {
    const win = getCurrentWindow();
    await win.minimize();
  };

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    if (fileId) {
      fileStore.updateFile(fileId, newContent);
    }
  }, [fileId]);

  const handleExecute = useCallback(async () => {
    if (!content.trim()) return;
    try {
      await executeScript(transformScript(content));
    } catch (err) {
      console.error('Execution failed:', err);
    }
  }, [content]);

  const renderContent = () => {
    switch (tabType) {
      case 'explorer':
        return <ExplorerPanel />;
      case 'editor':
        return (
          <CodeEditor
            value={content}
            onChange={handleContentChange}
            fileId={fileId || tabId}
            fileName={tabTitle}
          />
        );
      default:
        return (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.textMuted,
            fontSize: 13,
          }}>
            Unsupported tab type: {tabType}
          </div>
        );
    }
  };

  return (
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 12,
            fontWeight: 500,
            color: colors.textWhite,
          }}>
            {tabTitle}
          </span>
          <span style={{
            fontSize: 10,
            color: colors.textMuted,
            background: colors.surfaceDark,
            padding: '2px 6px',
            borderRadius: 4,
          }}>
            {tabType}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton icon={<Minus size={14} />} onClick={handleMinimize} />
          <IconButton icon={<X size={14} />} onClick={handleClose} />
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {renderContent()}
        {tabType === 'editor' && (
          <FloatingRunButton onExecute={handleExecute} />
        )}
      </div>
    </div>
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

interface FloatingRunButtonProps {
  onExecute: () => void;
}

const DETACHED_RUN_BTN_KEY = 'synapsez_detached_run_pos';

function FloatingRunButton({ onExecute }: FloatingRunButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [runHovered, setRunHovered] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DETACHED_RUN_BTN_KEY);
      if (saved) {
        setPosition(JSON.parse(saved));
        return;
      }
    } catch {}
    const container = containerRef.current?.parentElement;
    if (container) {
      const rect = container.getBoundingClientRect();
      setPosition({ x: rect.width - 100, y: rect.height - 60 });
    }
  }, []);

  const handleHandleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current?.parentElement;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const newX = e.clientX - containerRect.left - dragOffset.current.x;
      const newY = e.clientY - containerRect.top - dragOffset.current.y;
      setPosition({
        x: Math.max(8, Math.min(containerRect.width - 100, newX)),
        y: Math.max(8, Math.min(containerRect.height - 50, newY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (position) {
        try {
          localStorage.setItem(DETACHED_RUN_BTN_KEY, JSON.stringify(position));
        } catch {}
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, position]);

  if (!position) return <div ref={containerRef} style={{ display: 'none' }} />;

  return (
    <>
      <div ref={containerRef} style={{ display: 'none' }} />
      <div
        ref={cardRef}
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          zIndex: 100,
          background: '#111114',
          border: '1px solid #1e1e22',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        <div
          onMouseDown={handleHandleMouseDown}
          style={{
            width: 24,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isDragging ? 'grabbing' : 'grab',
            borderRight: '1px solid #1e1e22',
          }}
        >
          <svg width="6" height="14" viewBox="0 0 6 14" fill="none">
            <circle cx="1.5" cy="2" r="1" fill="#444"/>
            <circle cx="4.5" cy="2" r="1" fill="#444"/>
            <circle cx="1.5" cy="7" r="1" fill="#444"/>
            <circle cx="4.5" cy="7" r="1" fill="#444"/>
            <circle cx="1.5" cy="12" r="1" fill="#444"/>
            <circle cx="4.5" cy="12" r="1" fill="#444"/>
          </svg>
        </div>
        <div
          onClick={onExecute}
          onMouseEnter={() => setRunHovered(true)}
          onMouseLeave={() => setRunHovered(false)}
          style={{
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            background: runHovered ? '#1a1a1e' : 'transparent',
            transition: 'background 0.1s ease',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 1L10 6L2 11V1Z" fill={runHovered ? '#fff' : '#888'}/>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 500, color: runHovered ? '#fff' : '#888' }}>
            Run
          </span>
        </div>
      </div>
    </>
  );
}
