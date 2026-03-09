import { useState, useRef, useEffect, useCallback } from 'react';
import { colors } from '../../config/theme';
import { IconButton } from '../shared/IconButton';
import { Search, Filter, Trash2, Square, ChevronUp, X } from 'lucide-react';
import {
  getDiagnostics,
  clearDiagnostics,
  subscribeToDiagnostics,
  Diagnostic,
} from '../../stores/diagnosticStore';
import { navigateToPosition } from '../../stores/editorNavigationStore';

export type LogType = 'info' | 'success' | 'warning' | 'error' | 'status';

export interface LogEntry {
  id: string;
  type: LogType;
  message: string;
  timestamp: Date;
  fileName?: string;
  line?: number;
  column?: number;
}

interface TerminalPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  height: number;
  onHeightChange: (height: number) => void;
  position: 'top' | 'bottom';
  order?: number;
  activeFileId?: string;
}

const LOG_TYPE_COLORS: Record<LogType, string> = {
  info: colors.textMuted,
  success: colors.success,
  warning: '#FFA726',
  error: colors.error,
  status: colors.primary,
};

const FILTER_OPTIONS: { value: LogType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'info', label: 'Info' },
  { value: 'success', label: 'Success' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
  { value: 'status', label: 'Status' },
];

function diagnosticsToLogs(diagnostics: Diagnostic[]): LogEntry[] {
  return diagnostics.map((d) => ({
    id: d.id,
    type: d.severity === 'error' ? 'error' : d.severity === 'warning' ? 'warning' : 'info',
    message: d.message,
    timestamp: d.timestamp,
    fileName: d.fileName,
    line: d.line,
    column: d.column,
  }));
}

export function TerminalPanel({ isOpen, onToggle, height, onHeightChange, position, order, activeFileId }: TerminalPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [filterType, setFilterType] = useState<LogType | 'all'>('all');
  const [showFilter, setShowFilter] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startHeight = useRef(0);

  useEffect(() => {
    const updateLogs = () => {
      if (activeFileId) {
        const diagnostics = getDiagnostics(activeFileId);
        setLogs(diagnosticsToLogs(diagnostics));
      } else {
        setLogs([]);
      }
    };

    updateLogs();
    const unsubscribe = subscribeToDiagnostics(updateLogs);
    return unsubscribe;
  }, [activeFileId]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleClear = () => {
    if (activeFileId) {
      clearDiagnostics(activeFileId);
    }
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;
      e.preventDefault();
      const delta = position === 'bottom' 
        ? startY.current - e.clientY 
        : e.clientY - startY.current;
      const newHeight = startHeight.current + delta;
      const clampedHeight = Math.max(80, Math.min(500, newHeight));
      onHeightChange(clampedHeight);
    },
    [isResizing, onHeightChange, position]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    startY.current = e.clientY;
    startHeight.current = height;
    setIsResizing(true);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  };

  const filteredLogs = logs.filter((log) => {
    if (filterType !== 'all' && log.type !== filterType) return false;
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div
      ref={containerRef}
      style={{
        height: isOpen ? height : 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#0d0d11',
        borderTop: position === 'bottom' && isOpen ? '1px solid #1a1a1f' : 'none',
        borderBottom: position === 'top' && isOpen ? '1px solid #1a1a1f' : 'none',
        order: order,
        overflow: 'hidden',
        transition: 'height 0.15s ease',
      }}
    >
      <div
        onMouseDown={handleResizeStart}
        style={{
          height: 32,
          cursor: 'ns-resize',
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          borderBottom: position === 'bottom' ? '1px solid #1a1a1f' : 'none',
          borderTop: position === 'top' ? '1px solid #1a1a1f' : 'none',
          flexShrink: 0,
          position: 'relative',
          order: position === 'top' ? 1 : 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            [position === 'bottom' ? 'top' : 'bottom']: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: isResizing ? 60 : 40,
            height: 3,
            background: isResizing ? '#4a4a55' : '#2a2a35',
            boxShadow: isResizing ? 'inset 0 1px 3px rgba(0,0,0,0.4)' : 'none',
            borderRadius: position === 'bottom' ? '0 0 2px 2px' : '2px 2px 0 0',
            transition: isResizing ? 'none' : 'all 0.15s ease',
          }}
        />

        <span style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, letterSpacing: '0.05em' }}>
          TERMINAL
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              background: searchFocused ? '#18181d' : '#0a0a0e',
              border: `1px solid ${searchFocused ? colors.primary : '#1a1a1f'}`,
              borderRadius: 5,
              transition: 'all 0.15s ease',
            }}
          >
            <Search size={13} color={colors.textMuted} />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{
                width: 110,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 12,
                color: colors.textWhite,
              }}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <IconButton tooltip="Filter" onClick={() => setShowFilter(!showFilter)} active={showFilter}>
              <Filter size={14} />
            </IconButton>
            {showFilter && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  padding: 4,
                  background: '#18181d',
                  border: '1px solid #1a1a1f',
                  borderRadius: 8,
                  zIndex: 100,
                  minWidth: 100,
                }}
              >
                {FILTER_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    onClick={() => {
                      setFilterType(option.value);
                      setShowFilter(false);
                    }}
                    style={{
                      padding: '6px 10px',
                      fontSize: 12,
                      color: filterType === option.value ? colors.primary : colors.textWhite,
                      cursor: 'pointer',
                      borderRadius: 4,
                      background: filterType === option.value ? `${colors.primary}15` : 'transparent',
                    }}
                  >
                    {option.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          <IconButton tooltip="Clear" onClick={handleClear}>
            <Trash2 size={14} />
          </IconButton>

          <IconButton tooltip="Stop">
            <Square size={14} />
          </IconButton>

          <IconButton tooltip="Minimize" onClick={onToggle}>
            <ChevronUp size={14} />
          </IconButton>

          <IconButton tooltip="Close" onClick={onToggle}>
            <X size={14} />
          </IconButton>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
          fontFamily: 'monospace',
          fontSize: 12,
          order: position === 'top' ? 0 : 1,
        }}
      >
        {filteredLogs.length === 0 ? (
          <div style={{ color: colors.textMuted }}>
            <div style={{ fontSize: 13, marginBottom: 4 }}>No issues detected</div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>Syntax errors and warnings will appear here</div>
          </div>
        ) : (
          <>
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                onClick={() => {
                  if (activeFileId && log.line && log.column) {
                    navigateToPosition(activeFileId, log.line, log.column);
                  }
                }}
                style={{
                  display: 'flex',
                  gap: 8,
                  marginBottom: 2,
                  padding: '3px 6px',
                  color: LOG_TYPE_COLORS[log.type],
                  alignItems: 'flex-start',
                  cursor: log.line ? 'pointer' : 'default',
                  borderRadius: 4,
                  transition: 'background 0.1s ease',
                }}
                onMouseEnter={(e) => {
                  if (log.line) e.currentTarget.style.background = '#15151a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ opacity: 0.4, flexShrink: 0 }}>
                  {log.type === 'error' ? '✕' : log.type === 'warning' ? '⚠' : 'ℹ'}
                </span>
                <span style={{ flex: 1 }}>{log.message}</span>
                {log.fileName && log.line && (
                  <span style={{
                    opacity: 0.5,
                    flexShrink: 0,
                    fontSize: 11,
                    textDecoration: 'underline',
                    textDecorationColor: 'rgba(255,255,255,0.15)',
                    textUnderlineOffset: 2,
                  }}>
                    {log.fileName}:{log.line}:{log.column}
                  </span>
                )}
              </div>
            ))}
            <div ref={logsEndRef} />
          </>
        )}
      </div>
    </div>
  );
}
