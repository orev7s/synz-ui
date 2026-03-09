import { useState, useEffect, useCallback, useSyncExternalStore, memo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { colors } from '../../../config/theme';
import { useAccentColor } from '../../../hooks/useAccentColor';
import { CodeEditor } from '../../../editor';
import {
  getExplorerState,
  subscribeExplorer,
  stopExplorerServer,
  getChildren,
  getProperties,
  searchInstances,
  getServices,
  decompileScript,
  getNilInstances,
  getLoadedModules,
  setProperty,
  sendExplorerMessage,
  InstanceInfo,
  clearExplorerCaches,
} from '../../../stores/explorerStore';
import {
  Search,
  ChevronRight,
  ChevronDown,
  Folder,
  FileCode,
  Box,
  Users,
  Zap,
  Copy,
  RefreshCw,
  Unplug,
  Loader2,
  AlertTriangle,
  X,
  Eye,
  Package,
  Layers,
  Save,
  ExternalLink,
  FolderOpen,
  Download,
} from 'lucide-react';

const VIRTUAL_ITEM_HEIGHT = 24;
const VIRTUAL_OVERSCAN = 5;

interface FlatNode {
  instance: InstanceInfo;
  level: number;
  isExpanded: boolean;
  isLoading: boolean;
  hasChildren: boolean;
}

interface TreeNodeProps {
  node: FlatNode;
  isSelected: boolean;
  onToggle: (path: string) => void;
  onSelect: (instance: InstanceInfo) => void;
  accentColor: string;
}

const TreeNodeRow = memo(function TreeNodeRow({ node, isSelected, onToggle, onSelect, accentColor }: TreeNodeProps) {
  const { instance, level, isExpanded, isLoading, hasChildren } = node;

  const handleExpandClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      onToggle(instance.path);
    }
  }, [hasChildren, instance.path, onToggle]);

  const handleRowClick = useCallback(() => {
    onSelect(instance);
  }, [instance, onSelect]);

  const handleDoubleClick = useCallback(() => {
    if (hasChildren) {
      onToggle(instance.path);
    }
  }, [hasChildren, instance.path, onToggle]);

  const getIcon = () => {
    const cn = instance.className;
    if (cn === 'Folder') return <Folder size={12} />;
    if (instance.isScript) return <FileCode size={12} color="#4ADE80" />;
    if (cn === 'Model' || cn === 'Actor') return <Box size={12} />;
    if (cn === 'Player' || cn === 'Players') return <Users size={12} />;
    if (cn.includes('Event') || cn.includes('Function')) return <Zap size={12} color="#FBBF24" />;
    return <Box size={12} />;
  };

  return (
    <div
      onClick={handleRowClick}
      onDoubleClick={handleDoubleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        height: VIRTUAL_ITEM_HEIGHT,
        padding: '0 8px',
        paddingLeft: level * 16 + 8,
        cursor: 'pointer',
        background: isSelected ? `${accentColor}20` : 'transparent',
        borderLeft: isSelected ? `2px solid ${accentColor}` : '2px solid transparent',
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={handleExpandClick}
        style={{
          width: 14,
          height: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: hasChildren ? 'pointer' : 'default',
          opacity: hasChildren ? 1 : 0.3,
          flexShrink: 0,
        }}
      >
        {isLoading ? (
          <Loader2 size={10} className="spin-animation" />
        ) : hasChildren ? (
          isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />
        ) : null}
      </div>
      <div style={{ color: colors.textMuted, flexShrink: 0 }}>{getIcon()}</div>
      <span
        style={{
          fontSize: 11,
          color: isSelected ? colors.textWhite : colors.textMuted,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          minWidth: 0,
        }}
      >
        {instance.name}
      </span>
      <span style={{ fontSize: 9, color: '#555', flexShrink: 0 }}>{instance.className}</span>
    </div>
  );
});

interface VirtualTreeProps {
  nodes: FlatNode[];
  selectedPath: string | null;
  onToggle: (path: string) => void;
  onSelect: (instance: InstanceInfo) => void;
  accentColor: string;
}

function VirtualTree({ nodes, selectedPath, onToggle, onSelect, accentColor }: VirtualTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(container);
    setContainerHeight(container.clientHeight);

    return () => resizeObserver.disconnect();
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const totalHeight = nodes.length * VIRTUAL_ITEM_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / VIRTUAL_ITEM_HEIGHT) - VIRTUAL_OVERSCAN);
  const endIndex = Math.min(
    nodes.length,
    Math.ceil((scrollTop + containerHeight) / VIRTUAL_ITEM_HEIGHT) + VIRTUAL_OVERSCAN
  );

  const visibleNodes = nodes.slice(startIndex, endIndex);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: startIndex * VIRTUAL_ITEM_HEIGHT, width: '100%' }}>
          {visibleNodes.map((node) => (
            <TreeNodeRow
              key={node.instance.path}
              node={node}
              isSelected={selectedPath === node.instance.path}
              onToggle={onToggle}
              onSelect={onSelect}
              accentColor={accentColor}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface PropertyRowProps {
  name: string;
  value: unknown;
  instancePath: string;
  onPropertyChange: () => void;
}

const PropertyRow = memo(function PropertyRow({ name, value, instancePath, onPropertyChange }: PropertyRowProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const getEditableValue = (): { editable: boolean; currentValue: string; valueType: string } => {
    if (value === null || value === undefined) return { editable: false, currentValue: '', valueType: 'nil' };
    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      if (obj.type === 'string') return { editable: true, currentValue: String(obj.value), valueType: 'string' };
      if (obj.type === 'number') return { editable: true, currentValue: String(obj.value), valueType: 'number' };
      if (obj.type === 'boolean') return { editable: true, currentValue: String(obj.value), valueType: 'boolean' };
      return { editable: false, currentValue: '', valueType: String(obj.type) };
    }
    return { editable: false, currentValue: '', valueType: 'unknown' };
  };

  const { editable, currentValue, valueType } = getEditableValue();

  const handleStartEdit = useCallback(() => {
    if (!editable) return;
    setEditValue(currentValue);
    setEditing(true);
  }, [editable, currentValue]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    let parsedValue: unknown = editValue;

    if (valueType === 'number') {
      parsedValue = parseFloat(editValue);
      if (isNaN(parsedValue as number)) {
        setSaving(false);
        return;
      }
    } else if (valueType === 'boolean') {
      parsedValue = editValue.toLowerCase() === 'true';
    }

    const result = await setProperty(instancePath, name, parsedValue);
    setSaving(false);
    setEditing(false);

    if (result.success) {
      onPropertyChange();
    }
  }, [editValue, valueType, instancePath, name, onPropertyChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditing(false);
    }
  }, [handleSave]);

  const renderValue = () => {
    if (value === null || value === undefined) return <span style={{ color: '#666' }}>nil</span>;
    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      if (obj.type === 'string') return <span style={{ color: '#CE9178' }}>"{String(obj.value)}"</span>;
      if (obj.type === 'number') return <span style={{ color: '#B5CEA8' }}>{String(obj.value)}</span>;
      if (obj.type === 'boolean') return <span style={{ color: '#569CD6' }}>{String(obj.value)}</span>;
      if (obj.type === 'Instance') return <span style={{ color: '#4EC9B0' }}>{String(obj.name)}</span>;
      if (obj.type === 'Vector3')
        return (
          <span style={{ color: '#DCDCAA' }}>
            ({String(obj.x)}, {String(obj.y)}, {String(obj.z)})
          </span>
        );
      if (obj.type === 'Color3')
        return (
          <span style={{ color: '#DCDCAA' }}>
            Color3({String(obj.r)}, {String(obj.g)}, {String(obj.b)})
          </span>
        );
      if (obj.type === 'EnumItem') return <span style={{ color: '#9CDCFE' }}>{String(obj.name)}</span>;
      return <span style={{ color: '#666' }}>{String(obj.type)}</span>;
    }
    return <span>{String(value)}</span>;
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 8px',
        borderBottom: '1px solid #1a1a1f',
        fontSize: 11,
        minHeight: 24,
      }}
    >
      <span style={{ color: colors.textMuted }}>{name}</span>
      {editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => setEditing(false)}
            autoFocus
            style={{
              width: 120,
              padding: '2px 6px',
              background: '#0a0a0e',
              border: '1px solid #2a2a35',
              borderRadius: 3,
              color: colors.textWhite,
              fontSize: 11,
              outline: 'none',
            }}
          />
          {saving && <Loader2 size={10} className="spin-animation" />}
        </div>
      ) : (
        <div
          onDoubleClick={handleStartEdit}
          style={{
            cursor: editable ? 'pointer' : 'default',
            padding: '2px 4px',
            borderRadius: 3,
          }}
          title={editable ? 'Double-click to edit' : undefined}
        >
          {renderValue()}
        </div>
      )}
    </div>
  );
});

type TabType = 'tree' | 'search' | 'nil' | 'modules';

export function ExplorerPanel() {
  const accent = useAccentColor();
  const explorerState = useSyncExternalStore(subscribeExplorer, getExplorerState);

  const [services, setServices] = useState<InstanceInfo[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [childrenMap, setChildrenMap] = useState<Map<string, InstanceInfo[]>>(new Map());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<InstanceInfo | null>(null);
  const [properties, setProperties] = useState<Record<string, unknown>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<InstanceInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('tree');
  const [nilInstances, setNilInstances] = useState<InstanceInfo[]>([]);
  const [loadedModules, setLoadedModules] = useState<InstanceInfo[]>([]);
  const [decompileResult, setDecompileResult] = useState<string | null>(null);
  const [decompiling, setDecompiling] = useState(false);
  const [dumpingAll, setDumpingAll] = useState(false);
  const [dumpProgress, setDumpProgress] = useState<{ current: number; total: number } | null>(null);
  const [lastDumpPath, setLastDumpPath] = useState<string | null>(null);
  const [decompilePanelWidth, setDecompilePanelWidth] = useState(500);
  const [isResizing, setIsResizing] = useState(false);
  const [propertiesLoading, setPropertiesLoading] = useState(false);

  const pendingSelectRef = useRef<string | null>(null);

  const loadServices = useCallback(async () => {
    try {
      const result = await getServices();
      setServices(
        result.map((s) => ({
          name: s.name,
          className: s.className,
          path: s.path,
          childCount: 1,
          id: 0,
        }))
      );
    } catch (e) {
      console.error('Failed to load services:', e);
    }
  }, []);

  useEffect(() => {
    if (explorerState.state === 'connected') {
      loadServices();
    } else {
      setServices([]);
      setExpandedPaths(new Set());
      setChildrenMap(new Map());
      setSelectedPath(null);
      setSelectedInstance(null);
      setProperties({});
    }
  }, [explorerState.state, loadServices]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = document.getElementById('explorer-main-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newWidth = rect.right - e.clientX;
      setDecompilePanelWidth(Math.max(300, Math.min(800, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const handleToggle = useCallback(async (path: string) => {
    if (loadingPaths.has(path)) return;

    if (expandedPaths.has(path)) {
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
      return;
    }

    if (!childrenMap.has(path)) {
      setLoadingPaths((prev) => new Set(prev).add(path));
      try {
        const children = await getChildren(path);
        setChildrenMap((prev) => new Map(prev).set(path, children));
      } catch (e) {
        console.error('Failed to load children:', e);
      }
      setLoadingPaths((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    }

    setExpandedPaths((prev) => new Set(prev).add(path));
  }, [expandedPaths, loadingPaths, childrenMap]);

  const handleSelect = useCallback(async (instance: InstanceInfo) => {
    if (pendingSelectRef.current === instance.path) return;

    setSelectedPath(instance.path);
    setSelectedInstance(instance);
    setDecompileResult(null);

    pendingSelectRef.current = instance.path;
    setPropertiesLoading(true);

    try {
      const props = await getProperties(instance.path);
      if (pendingSelectRef.current === instance.path) {
        setProperties(props);
      }
    } catch (e) {
      console.error('Failed to get properties:', e);
      if (pendingSelectRef.current === instance.path) {
        setProperties({});
      }
    }

    if (pendingSelectRef.current === instance.path) {
      setPropertiesLoading(false);
      pendingSelectRef.current = null;
    }
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchInstances(searchQuery, { maxResults: 50 });
      setSearchResults(results);
      setActiveTab('search');
    } catch (e) {
      console.error('Search failed:', e);
    }
    setSearching(false);
  }, [searchQuery]);

  const handleDecompile = useCallback(async () => {
    if (!selectedInstance?.isScript) return;
    setDecompiling(true);
    try {
      const result = await decompileScript(selectedInstance.path);
      setDecompileResult(result.source || result.error || 'Failed to decompile');
    } catch (e) {
      setDecompileResult('Failed to decompile: ' + String(e));
    }
    setDecompiling(false);
  }, [selectedInstance]);

  const handleLoadNil = useCallback(async () => {
    try {
      const result = await getNilInstances();
      setNilInstances(result);
      setActiveTab('nil');
    } catch (e) {
      console.error('Failed to load nil instances:', e);
    }
  }, []);

  const handleLoadModules = useCallback(async () => {
    try {
      const result = await getLoadedModules();
      setLoadedModules(result);
      setActiveTab('modules');
    } catch (e) {
      console.error('Failed to load modules:', e);
    }
  }, []);

  const handleCopyPath = useCallback(() => {
    if (selectedInstance) {
      navigator.clipboard.writeText(selectedInstance.path);
    }
  }, [selectedInstance]);

  const handleDisconnect = useCallback(async () => {
    await stopExplorerServer();
  }, []);

  const handleRefresh = useCallback(async () => {
    clearExplorerCaches();
    setChildrenMap(new Map());
    setExpandedPaths(new Set());
    await loadServices();
  }, [loadServices]);

  const handleSaveToDevice = useCallback(async () => {
    if (!decompileResult || !selectedInstance) return;
    try {
      const path = await invoke<string>('save_decompiled_script', {
        name: selectedInstance.name,
        content: decompileResult
      });
      setLastDumpPath(path);
    } catch (e) {
      console.error('Failed to save:', e);
    }
  }, [decompileResult, selectedInstance]);

  const handleOpenInNewTab = useCallback(async () => {
    if (!decompileResult || !selectedInstance) return;
    await emit('open-decompiled-in-tab', {
      name: `${selectedInstance.name} (decompiled)`,
      content: decompileResult
    });
    setDecompileResult(null);
  }, [decompileResult, selectedInstance]);

  const handleDumpAllScripts = useCallback(async () => {
    if (dumpingAll) return;
    setDumpingAll(true);
    setDumpProgress({ current: 0, total: 0 });

    try {
      const response = await sendExplorerMessage('getAllScripts', { maxScripts: 1000 });
      const allScripts = (response.scripts as InstanceInfo[]) || [];

      if (allScripts.length === 0) {
        setDumpingAll(false);
        setDumpProgress(null);
        return;
      }

      setDumpProgress({ current: 0, total: allScripts.length });

      const decompiled: [string, string][] = [];
      for (let i = 0; i < allScripts.length; i++) {
        setDumpProgress({ current: i + 1, total: allScripts.length });
        try {
          const result = await decompileScript(allScripts[i].path);
          if (result.source) {
            decompiled.push([allScripts[i].path, result.source]);
          }
        } catch {
        }
      }

      if (decompiled.length > 0) {
        const dumpPath = await invoke<string>('save_all_scripts', { scripts: decompiled });
        setLastDumpPath(dumpPath);
        await invoke('open_folder_in_explorer', { path: dumpPath });
      }
    } catch (e) {
      console.error('Failed to dump scripts:', e);
    }

    setDumpingAll(false);
    setDumpProgress(null);
  }, [dumpingAll]);

  const handleOpenWorkspace = useCallback(async () => {
    try {
      if (lastDumpPath) {
        await invoke('open_folder_in_explorer', { path: lastDumpPath });
      } else {
        const workspacePath = await invoke<string>('get_workspace_path');
        await invoke('open_folder_in_explorer', { path: workspacePath });
      }
    } catch (e) {
      console.error('Failed to open folder:', e);
    }
  }, [lastDumpPath]);

  const flattenTree = useCallback((
    instances: InstanceInfo[],
    level: number
  ): FlatNode[] => {
    const result: FlatNode[] = [];

    for (const instance of instances) {
      const isExpanded = expandedPaths.has(instance.path);
      const isLoading = loadingPaths.has(instance.path);
      const hasChildren = instance.childCount > 0;

      result.push({
        instance,
        level,
        isExpanded,
        isLoading,
        hasChildren,
      });

      if (isExpanded) {
        const children = childrenMap.get(instance.path);
        if (children && children.length > 0) {
          result.push(...flattenTree(children, level + 1));
        }
      }
    }

    return result;
  }, [expandedPaths, loadingPaths, childrenMap]);

  const getActiveNodes = useCallback((): FlatNode[] => {
    switch (activeTab) {
      case 'tree':
        return flattenTree(services, 0);
      case 'search':
        return searchResults.map((inst) => ({
          instance: inst,
          level: 0,
          isExpanded: false,
          isLoading: false,
          hasChildren: inst.childCount > 0,
        }));
      case 'nil':
        return nilInstances.map((inst) => ({
          instance: inst,
          level: 0,
          isExpanded: false,
          isLoading: false,
          hasChildren: inst.childCount > 0,
        }));
      case 'modules':
        return loadedModules.map((inst) => ({
          instance: inst,
          level: 0,
          isExpanded: false,
          isLoading: false,
          hasChildren: inst.childCount > 0,
        }));
      default:
        return [];
    }
  }, [activeTab, services, searchResults, nilInstances, loadedModules, flattenTree]);

  const activeNodes = getActiveNodes();

  if (explorerState.state !== 'connected') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 16,
          background: colors.bgDark,
        }}
      >
        <AlertTriangle size={32} color={colors.textMuted} />
        <span style={{ fontSize: 13, color: colors.textMuted }}>
          {explorerState.serverRunning ? 'Waiting for game connection...' : 'Explorer not started'}
        </span>
        {explorerState.serverRunning && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Loader2 size={14} className="spin-animation" color={accent.primary} />
            <span style={{ fontSize: 11, color: '#555' }}>Listening on port 21574</span>
          </div>
        )}
        <style>{`
          .spin-animation {
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div id="explorer-main-container" style={{ display: 'flex', height: '100%', background: colors.bgDark }}>
      <div
        style={{
          width: 280,
          borderRight: '1px solid #1a1a1f',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '8px 10px',
            borderBottom: '1px solid #1a1a1f',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 8px',
                background: '#111115',
                border: '1px solid #1a1a1f',
                borderRadius: 5,
              }}
            >
              <Search size={12} color={colors.textMuted} />
              <input
                type="text"
                placeholder="Search instances..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 11,
                  color: colors.textWhite,
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted }}
                >
                  <X size={10} />
                </button>
              )}
            </div>
            <button
              onClick={handleSearch}
              disabled={searching}
              style={{
                padding: '6px 10px',
                background: accent.primary,
                border: 'none',
                borderRadius: 5,
                color: '#000',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {searching ? <Loader2 size={10} className="spin-animation" /> : 'Go'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { id: 'tree' as TabType, label: 'Tree', icon: Layers },
              { id: 'search' as TabType, label: 'Search', icon: Search },
              { id: 'nil' as TabType, label: 'Nil', icon: Eye },
              { id: 'modules' as TabType, label: 'Modules', icon: Package },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'nil') handleLoadNil();
                  else if (tab.id === 'modules') handleLoadModules();
                  else setActiveTab(tab.id);
                }}
                style={{
                  flex: 1,
                  padding: '5px 6px',
                  background: activeTab === tab.id ? '#1a1a1f' : 'transparent',
                  border: '1px solid #1a1a1f',
                  borderRadius: 4,
                  color: activeTab === tab.id ? colors.textWhite : colors.textMuted,
                  fontSize: 9,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <tab.icon size={10} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeNodes.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: colors.textMuted, fontSize: 11 }}>
            {activeTab === 'tree' ? 'Loading...' : 'No items found'}
          </div>
        ) : (
          <VirtualTree
            nodes={activeNodes}
            selectedPath={selectedPath}
            onToggle={handleToggle}
            onSelect={handleSelect}
            accentColor={accent.primary}
          />
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid #1a1a1f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: colors.textWhite }}>
              {selectedInstance?.name || 'No selection'}
            </span>
            {selectedInstance && (
              <span style={{ fontSize: 10, color: colors.textMuted }}>{selectedInstance.className}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {selectedInstance && (
              <button
                onClick={handleCopyPath}
                style={{
                  padding: '4px 8px',
                  background: '#18181d',
                  border: '1px solid #2a2a35',
                  borderRadius: 4,
                  color: colors.textMuted,
                  fontSize: 10,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Copy size={10} />
                Copy Path
              </button>
            )}
            {selectedInstance?.isScript && (
              <button
                onClick={handleDecompile}
                disabled={decompiling}
                style={{
                  padding: '4px 8px',
                  background: accent.primary,
                  border: 'none',
                  borderRadius: 4,
                  color: '#000',
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {decompiling ? <Loader2 size={10} className="spin-animation" /> : <FileCode size={10} />}
                Decompile
              </button>
            )}
            <button
              onClick={handleRefresh}
              style={{
                padding: '4px 8px',
                background: '#18181d',
                border: '1px solid #2a2a35',
                borderRadius: 4,
                color: colors.textMuted,
                fontSize: 10,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <RefreshCw size={10} />
            </button>
            <button
              onClick={handleDumpAllScripts}
              disabled={dumpingAll}
              title="Dump all scripts"
              style={{
                padding: '4px 8px',
                background: dumpingAll ? '#18181d' : accent.primary + '20',
                border: `1px solid ${dumpingAll ? '#2a2a35' : accent.primary + '40'}`,
                borderRadius: 4,
                color: dumpingAll ? colors.textMuted : accent.primary,
                fontSize: 10,
                cursor: dumpingAll ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {dumpingAll ? (
                <>
                  <Loader2 size={10} className="spin-animation" />
                  {dumpProgress ? `${dumpProgress.current}/${dumpProgress.total}` : 'Dumping...'}
                </>
              ) : (
                <>
                  <Download size={10} />
                  Dump All
                </>
              )}
            </button>
            <button
              onClick={handleOpenWorkspace}
              title="Open workspace folder"
              style={{
                padding: '4px 8px',
                background: '#18181d',
                border: '1px solid #2a2a35',
                borderRadius: 4,
                color: colors.textMuted,
                fontSize: 10,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <FolderOpen size={10} />
            </button>
            <button
              onClick={handleDisconnect}
              style={{
                padding: '4px 8px',
                background: '#FF4D6A20',
                border: '1px solid #FF4D6A40',
                borderRadius: 4,
                color: '#FF4D6A',
                fontSize: 10,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Unplug size={10} />
              Disconnect
            </button>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', borderRight: '1px solid #1a1a1f' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #1a1a1f' }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: colors.textMuted }}>Properties</span>
            </div>
            {propertiesLoading ? (
              <div style={{ padding: 16, textAlign: 'center', color: '#555', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Loader2 size={12} className="spin-animation" />
                Loading properties...
              </div>
            ) : Object.keys(properties).length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: '#555', fontSize: 11 }}>
                Select an instance to view properties
              </div>
            ) : (
              Object.entries(properties).map(([name, value]) => (
                <PropertyRow
                  key={name}
                  name={name}
                  value={value}
                  instancePath={selectedInstance?.path || ''}
                  onPropertyChange={async () => {
                    if (selectedInstance) {
                      const props = await getProperties(selectedInstance.path, true);
                      setProperties(props);
                    }
                  }}
                />
              ))
            )}
          </div>

          {decompileResult && (
            <>
              <div
                onMouseDown={() => setIsResizing(true)}
                style={{
                  width: 4,
                  cursor: 'col-resize',
                  background: isResizing ? accent.primary : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
                onMouseLeave={(e) => { if (!isResizing) e.currentTarget.style.background = 'transparent'; }}
              />
              <div style={{ width: decompilePanelWidth, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 300, maxWidth: 800 }}>
                <div
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #1a1a1f',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 500, color: colors.textMuted }}>Decompiled Source</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => navigator.clipboard.writeText(decompileResult)}
                      title="Copy to clipboard"
                      style={{
                        padding: '4px 6px',
                        background: '#18181d',
                        border: '1px solid #2a2a35',
                        borderRadius: 4,
                        cursor: 'pointer',
                        color: colors.textMuted,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Copy size={10} />
                    </button>
                    <button
                      onClick={handleSaveToDevice}
                      title="Save to device"
                      style={{
                        padding: '4px 6px',
                        background: '#18181d',
                        border: '1px solid #2a2a35',
                        borderRadius: 4,
                        cursor: 'pointer',
                        color: colors.textMuted,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Save size={10} />
                    </button>
                    <button
                      onClick={handleOpenInNewTab}
                      title="Open in new tab"
                      style={{
                        padding: '4px 6px',
                        background: '#18181d',
                        border: '1px solid #2a2a35',
                        borderRadius: 4,
                        cursor: 'pointer',
                        color: colors.textMuted,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <ExternalLink size={10} />
                    </button>
                    <button
                      onClick={() => setDecompileResult(null)}
                      title="Close"
                      style={{
                        padding: '4px 6px',
                        background: '#FF4D6A20',
                        border: '1px solid #FF4D6A40',
                        borderRadius: 4,
                        cursor: 'pointer',
                        color: '#FF4D6A',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <CodeEditor
                    value={decompileResult}
                    onChange={() => {}}
                    fileId={`decompile-${selectedInstance?.path || 'unknown'}`}
                    fileName={`${selectedInstance?.name || 'script'}.lua`}
                    readOnly
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        .spin-animation {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
