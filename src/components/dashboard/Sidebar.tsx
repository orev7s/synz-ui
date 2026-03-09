import { useState, useEffect, useCallback, useRef } from "react";
import { colors } from "../../config/theme";
import { useAccentColor } from "../../hooks/useAccentColor";
import {
  Settings,
  Plus,
  RefreshCw,
  Search,
  FileText,
  Cloud,
  Users,
  FolderOpen,
  User,
  ChevronRight,
  ChevronDown,
  Folder,
  Music,
  Image,
  File,
  Code,
  Zap,
  Check,
} from "lucide-react";
import {
  fileStore,
  subscribeToFileStore,
  VirtualFile,
  initializeFileStore,
} from "../../stores/fileStore";
import {
  WorkspaceNode,
  getRootEntries,
  subscribeWorkspace,
  loadWorkspaceRoot,
  toggleExpand,
  isExpanded,
  getChildren,
  refreshWorkspace,
  isTextFile,
  isWorkspaceInitialized,
} from "../../stores/workspaceStore";

interface SidebarProps {
  activeTab: string;
  onFileOpen: (fileId: string, fileName: string) => void;
  onFileDelete?: (fileId: string) => void;
  onSettingsClick?: () => void;
  onScriptHubClick?: () => void;
  onAccountClick?: () => void;
  onClientManagerClick?: () => void;
  onRevealInExplorer?: (fileId: string) => void;
  onWorkspaceFileOpen?: (path: string, name: string, content: string) => void;
  width: number;
  onWidthChange: (width: number) => void;
  position: "left" | "right";
  order?: number;
}

interface FileItemProps {
  file: VirtualFile;
  isActive?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent, file: VirtualFile) => void;
  accentColor: string;
}

function FileItem({
  file,
  isActive,
  onClick,
  onContextMenu,
  accentColor,
}: FileItemProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onContextMenu={(e) => onContextMenu?.(e, file)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        cursor: "pointer",
        background: isActive
          ? `linear-gradient(135deg, ${accentColor}15 0%, ${accentColor}08 100%)`
          : hovered
            ? "rgba(255,255,255,0.03)"
            : "transparent",
        borderRadius: 8,
        transition: "all 0.2s ease",
        border: isActive
          ? `1px solid ${accentColor}25`
          : "1px solid transparent",
        margin: "0 8px 2px 8px",
      }}
    >
      <FileText
        size={18}
        color={isActive ? accentColor : colors.textMuted}
        style={{ flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: 12,
            color: isActive ? colors.textWhite : colors.textMuted,
            fontWeight: isActive ? 500 : 400,
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {file.name}
        </span>
      </div>
      {file.isAutoexec && (
        <div
          title="Auto-execute enabled"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2px 6px",
            background: "#FBBF2420",
            borderRadius: 4,
            flexShrink: 0,
          }}
        >
          <Zap size={10} color="#FBBF24" />
        </div>
      )}
    </div>
  );
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  file: VirtualFile | null;
}

function getFileIcon(extension: string | null, isDir: boolean) {
  if (isDir) return <Folder size={14} color="#FBBF24" />;
  if (!extension) return <File size={14} color={colors.textMuted} />;
  const ext = extension.toLowerCase();
  if (ext === "lua" || ext === "luau")
    return <Code size={14} color="#4ADE80" />;
  if (ext === "json" || ext === "yaml" || ext === "yml" || ext === "toml")
    return <FileText size={14} color="#60A5FA" />;
  if (ext === "mp3" || ext === "wav" || ext === "ogg")
    return <Music size={14} color="#A78BFA" />;
  if (
    ext === "png" ||
    ext === "jpg" ||
    ext === "jpeg" ||
    ext === "gif" ||
    ext === "webp"
  )
    return <Image size={14} color="#F472B6" />;
  if (ext === "md" || ext === "txt")
    return <FileText size={14} color={colors.textMuted} />;
  return <File size={14} color={colors.textMuted} />;
}

interface WorkspaceItemProps {
  node: WorkspaceNode;
  level: number;
  onFileClick: (node: WorkspaceNode) => void;
  accentColor: string;
}

function WorkspaceItem({
  node,
  level,
  onFileClick,
  accentColor,
}: WorkspaceItemProps) {
  const [hovered, setHovered] = useState(false);
  const [loading, setLoading] = useState(false);
  const expanded = isExpanded(node.path);
  const children = getChildren(node.path);

  const handleClick = async () => {
    if (node.is_dir) {
      setLoading(true);
      await toggleExpand(node.path);
      setLoading(false);
    } else if (isTextFile(node.extension)) {
      onFileClick(node);
    }
  };

  return (
    <>
      <div
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          paddingLeft: 8 + level * 12,
          cursor:
            node.is_dir || isTextFile(node.extension) ? "pointer" : "default",
          background: hovered ? "rgba(255,255,255,0.03)" : "transparent",
          borderRadius: 4,
          transition: "background 0.15s ease",
          opacity: !node.is_dir && !isTextFile(node.extension) ? 0.5 : 1,
        }}
      >
        {node.is_dir && (
          <div
            style={{
              width: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {loading ? (
              <RefreshCw
                size={10}
                color={colors.textMuted}
                style={{ animation: "spin 1s linear infinite" }}
              />
            ) : expanded ? (
              <ChevronDown size={10} color={colors.textMuted} />
            ) : (
              <ChevronRight size={10} color={colors.textMuted} />
            )}
          </div>
        )}
        {!node.is_dir && <div style={{ width: 12 }} />}
        {getFileIcon(node.extension, node.is_dir)}
        <span
          style={{
            fontSize: 11,
            color: colors.textMuted,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {node.name}
        </span>
      </div>
      {node.is_dir &&
        expanded &&
        children &&
        children.map((child) => (
          <WorkspaceItem
            key={child.path}
            node={child}
            level={level + 1}
            onFileClick={onFileClick}
            accentColor={accentColor}
          />
        ))}
    </>
  );
}

export function Sidebar({
  activeTab,
  onFileOpen,
  onFileDelete,
  onSettingsClick,
  onScriptHubClick,
  onAccountClick,
  onClientManagerClick,
  onRevealInExplorer,
  onWorkspaceFileOpen,
  width,
  onWidthChange,
  position,
  order,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [files, setFiles] = useState<VirtualFile[]>([]);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    file: null,
  });
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isResizing, setIsResizing] = useState(false);
  const [workspaceExpanded, setWorkspaceExpanded] = useState(false);
  const [workspaceEntries, setWorkspaceEntries] = useState<WorkspaceNode[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [, forceUpdate] = useState(0);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const accent = useAccentColor();

  const handleResizeMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;
      e.preventDefault();
      const delta =
        position === "left"
          ? e.clientX - startX.current
          : startX.current - e.clientX;
      const newWidth = startWidth.current + delta;
      const clampedWidth = Math.max(200, Math.min(380, newWidth));
      onWidthChange(clampedWidth);
    },
    [isResizing, onWidthChange, position],
  );

  const handleResizeMouseUp = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleResizeMouseMove);
      document.addEventListener("mouseup", handleResizeMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleResizeMouseMove);
        document.removeEventListener("mouseup", handleResizeMouseUp);
      };
    }
  }, [isResizing, handleResizeMouseMove, handleResizeMouseUp]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    startX.current = e.clientX;
    startWidth.current = width;
    setIsResizing(true);
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  };

  const loadFiles = useCallback(() => {
    setFiles(fileStore.getAllFiles());
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await initializeFileStore();
      loadFiles();
      setIsLoading(false);
    };
    init();

    const unsubscribe = subscribeToFileStore(loadFiles);
    return unsubscribe;
  }, [loadFiles]);

  useEffect(() => {
    const unsubscribe = subscribeWorkspace(() => {
      setWorkspaceEntries(getRootEntries());
      forceUpdate((n) => n + 1);
    });
    return unsubscribe;
  }, []);

  const handleWorkspaceToggle = useCallback(async () => {
    const newExpanded = !workspaceExpanded;
    setWorkspaceExpanded(newExpanded);
    if (newExpanded && !isWorkspaceInitialized()) {
      setWorkspaceLoading(true);
      await loadWorkspaceRoot();
      setWorkspaceEntries(getRootEntries());
      setWorkspaceLoading(false);
    }
  }, [workspaceExpanded]);

  const handleWorkspaceRefresh = useCallback(async () => {
    setWorkspaceLoading(true);
    await refreshWorkspace();
    setWorkspaceEntries(getRootEntries());
    setWorkspaceLoading(false);
  }, []);

  const handleWorkspaceFileClick = useCallback(
    async (node: WorkspaceNode) => {
      if (onWorkspaceFileOpen && isTextFile(node.extension)) {
        try {
          const { readWorkspaceFile } =
            await import("../../stores/workspaceStore");
          const content = await readWorkspaceFile(node.path);
          onWorkspaceFileOpen(node.path, node.name, content);
        } catch (e) {
          console.error("Failed to read workspace file:", e);
        }
      }
    },
    [onWorkspaceFileOpen],
  );

  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };
    const handleCloseAll = () => {
      if (contextMenu.visible) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener("click", handleClickOutside);
    window.addEventListener("close-all-context-menus", handleCloseAll);
    return () => {
      document.removeEventListener("click", handleClickOutside);
      window.removeEventListener("close-all-context-menus", handleCloseAll);
    };
  }, [contextMenu.visible]);

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleCreateFile = () => {
    setIsCreatingFile(true);
    setNewFileName("");
  };

  const handleNewFileSubmit = async (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Enter") {
      const name = newFileName.trim();
      if (name) {
        const finalName =
          name.endsWith(".lua") || name.endsWith(".luau")
            ? name
            : `${name}.lua`;
        const existingFile = fileStore.getFileByName(finalName);
        if (!existingFile) {
          const newFile = await fileStore.createFile(
            finalName,
            `-- ${finalName}\n\n`,
          );
          onFileOpen(newFile.id, newFile.name);
        }
      }
      setIsCreatingFile(false);
      setNewFileName("");
    } else if (e.key === "Escape") {
      setIsCreatingFile(false);
      setNewFileName("");
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    await fileStore.loadFilesFromDisk();
    loadFiles();
    setIsLoading(false);
  };

  const handleContextMenu = (e: React.MouseEvent, file: VirtualFile) => {
    e.preventDefault();
    e.stopPropagation();

    window.dispatchEvent(new Event('close-all-context-menus'));

    const menuWidth = 160;
    const menuHeight = 80;
    const padding = 8;

    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth + padding > window.innerWidth) {
      x = e.clientX - menuWidth;
    }

    if (y + menuHeight + padding > window.innerHeight) {
      y = e.clientY - menuHeight;
    }

    setContextMenu({
      visible: true,
      x,
      y,
      file,
    });
  };

  const handleRename = () => {
    if (contextMenu.file) {
      setIsRenaming(contextMenu.file.id);
      setRenameValue(contextMenu.file.name);
    }
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleDelete = async () => {
    if (contextMenu.file) {
      await fileStore.deleteFile(contextMenu.file.id);
      onFileDelete?.(contextMenu.file.id);
    }
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleToggleAutoexec = async () => {
    if (contextMenu.file) {
      if (contextMenu.file.isAutoexec) {
        await fileStore.removeFromAutoexec(contextMenu.file.id);
      } else {
        await fileStore.addToAutoexec(contextMenu.file.id);
      }
    }
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleRevealInExplorer = () => {
    if (contextMenu.file) {
      onRevealInExplorer?.(contextMenu.file.id);
    }
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleRenameSubmit = async (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Enter" && isRenaming) {
      const newName = renameValue.trim();
      if (newName && newName !== fileStore.getFile(isRenaming)?.name) {
        const finalName =
          newName.endsWith(".lua") || newName.endsWith(".luau")
            ? newName
            : `${newName}.lua`;
        const existingFile = fileStore.getFileByName(finalName);
        if (!existingFile) {
          await fileStore.renameFile(isRenaming, finalName);
        }
      }
      setIsRenaming(null);
      setRenameValue("");
    } else if (e.key === "Escape") {
      setIsRenaming(null);
      setRenameValue("");
    }
  };

  return (
    <div
      style={{
        width,
        minWidth: 200,
        maxWidth: 380,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(180deg, #0e0e13 0%, #0a0a0e 100%)",
        borderLeft: position === "right" ? "1px solid rgba(255,255,255,0.04)" : "none",
        borderRight: position === "left" ? "1px solid rgba(255,255,255,0.04)" : "none",
        position: "relative",
        order: order,
      }}
    >
      <div
        onMouseDown={handleResizeStart}
        style={{
          position: "absolute",
          top: 0,
          [position === "left" ? "right" : "left"]: 0,
          width: 4,
          height: "100%",
          cursor: "ew-resize",
          zIndex: 10,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            [position === "left" ? "right" : "left"]: 0,
            width: 1,
            height: "100%",
            background: isResizing ? accent.primary : "transparent",
            transition: isResizing ? "none" : "all 0.15s ease",
          }}
        />
      </div>

      <div style={{ padding: "12px 12px 8px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            background: searchFocused
              ? "rgba(255,255,255,0.04)"
              : "rgba(255,255,255,0.02)",
            border: `1px solid ${searchFocused ? accent.primary + "40" : "rgba(255,255,255,0.04)"}`,
            borderRadius: 10,
            transition: "all 0.2s ease",
          }}
        >
          <Search
            size={14}
            color={searchFocused ? accent.primary : colors.textMuted}
          />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 12,
              color: colors.textWhite,
            }}
          />
        </div>
      </div>

      <div
        onClick={handleWorkspaceToggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          cursor: "pointer",
          background: workspaceExpanded
            ? "rgba(255,255,255,0.02)"
            : "transparent",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          transition: "background 0.15s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {workspaceExpanded ? (
            <ChevronDown size={12} color={colors.textMuted} />
          ) : (
            <ChevronRight size={12} color={colors.textMuted} />
          )}
          <Folder size={12} color="#FBBF24" />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: colors.textMuted,
              letterSpacing: "0.03em",
            }}
          >
            Workspace
          </span>
        </div>
        {workspaceExpanded && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleWorkspaceRefresh();
            }}
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <RefreshCw
              size={10}
              color={colors.textMuted}
              style={
                workspaceLoading
                  ? { animation: "spin 1s linear infinite" }
                  : undefined
              }
            />
          </div>
        )}
      </div>

      {workspaceExpanded && (
        <div
          style={{
            maxHeight: 200,
            overflowY: "auto",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            padding: "4px 0",
          }}
        >
          {workspaceLoading && workspaceEntries.length === 0 ? (
            <div style={{ padding: "12px", textAlign: "center" }}>
              <span style={{ fontSize: 11, color: colors.textMuted }}>
                Loading...
              </span>
            </div>
          ) : workspaceEntries.length === 0 ? (
            <div style={{ padding: "12px", textAlign: "center" }}>
              <span style={{ fontSize: 11, color: colors.textMuted }}>
                Workspace is empty
              </span>
            </div>
          ) : (
            workspaceEntries.map((entry) => (
              <WorkspaceItem
                key={entry.path}
                node={entry}
                level={0}
                onFileClick={handleWorkspaceFileClick}
                accentColor={accent.primary}
              />
            ))
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 12px 8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <FolderOpen size={12} color={accent.primary} />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: colors.textMuted,
              letterSpacing: "0.03em",
            }}
          >
            Scripts
          </span>
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          <div
            onClick={handleCreateFile}
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: "rgba(255,255,255,0.03)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.03)";
            }}
          >
            <Plus size={12} color={colors.textMuted} />
          </div>
          <div
            onClick={handleRefresh}
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: "rgba(255,255,255,0.03)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.03)";
            }}
          >
            <RefreshCw size={12} color={colors.textMuted} />
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        {isCreatingFile && (
          <div style={{ padding: "4px 12px" }}>
            <input
              type="text"
              placeholder="filename.lua"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={handleNewFileSubmit}
              onBlur={() => {
                setIsCreatingFile(false);
                setNewFileName("");
              }}
              autoFocus
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${accent.primary}40`,
                borderRadius: 8,
                outline: "none",
                fontSize: 12,
                color: colors.textWhite,
              }}
            />
          </div>
        )}
        {isLoading ? (
          <div style={{ padding: "16px 12px", textAlign: "center" }}>
            <span style={{ fontSize: 12, color: colors.textMuted }}>
              Loading...
            </span>
          </div>
        ) : filteredFiles.length === 0 && searchQuery ? (
          <div style={{ padding: "16px 12px", textAlign: "center" }}>
            <span style={{ fontSize: 12, color: colors.textMuted }}>
              No results found
            </span>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div style={{ padding: "16px 12px", textAlign: "center" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "rgba(255,255,255,0.02)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 10px",
              }}
            >
              <FileText size={18} color={colors.textMuted} />
            </div>
            <span style={{ fontSize: 12, color: colors.textMuted }}>
              No scripts yet
            </span>
            <div
              onClick={handleCreateFile}
              style={{
                marginTop: 10,
                padding: "8px 14px",
                background: `${accent.primary}15`,
                border: `1px solid ${accent.primary}30`,
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 12,
                color: accent.primary,
                fontWeight: 500,
                display: "inline-block",
              }}
            >
              Create Script
            </div>
          </div>
        ) : (
          filteredFiles.map((file) =>
            isRenaming === file.id ? (
              <div key={file.id} style={{ padding: "4px 12px" }}>
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={handleRenameSubmit}
                  onBlur={() => {
                    setIsRenaming(null);
                    setRenameValue("");
                  }}
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${accent.primary}40`,
                    borderRadius: 8,
                    outline: "none",
                    fontSize: 12,
                    color: colors.textWhite,
                  }}
                />
              </div>
            ) : (
              <FileItem
                key={file.id}
                file={file}
                isActive={activeTab === file.name}
                onClick={() => onFileOpen(file.id, file.name)}
                onContextMenu={handleContextMenu}
                accentColor={accent.primary}
              />
            ),
          )
        )}
      </div>

      <div
        style={{
          padding: "8px 12px",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          display: "flex",
          gap: 6,
        }}
      >
        <div
          onClick={onScriptHubClick}
          title="Script Hub"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px 12px",
            background: "rgba(255,255,255,0.02)",
            borderRadius: 8,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.02)";
          }}
        >
          <Cloud size={14} color={colors.textMuted} />
        </div>
        <div
          onClick={onClientManagerClick}
          title="Client Manager"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px 12px",
            background: "rgba(255,255,255,0.02)",
            borderRadius: 8,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.02)";
          }}
        >
          <Users size={14} color={colors.textMuted} />
        </div>
        <div
          onClick={onAccountClick}
          title="Account"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px 12px",
            background: "rgba(255,255,255,0.02)",
            borderRadius: 8,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.02)";
          }}
        >
          <User size={14} color={colors.textMuted} />
        </div>
        <div
          onClick={onSettingsClick}
          title="Settings"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px 12px",
            background: "rgba(255,255,255,0.02)",
            borderRadius: 8,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.02)";
          }}
        >
          <Settings size={14} color={colors.textMuted} />
        </div>
      </div>

      {contextMenu.visible && (
        <div
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            background: "#141418",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: "6px",
            zIndex: 10000,
            minWidth: 160,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            onClick={handleRename}
            style={{
              padding: "10px 14px",
              fontSize: 13,
              color: colors.textWhite,
              cursor: "pointer",
              borderRadius: 8,
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            Rename
          </div>
          <div
            onClick={handleToggleAutoexec}
            style={{
              padding: "10px 14px",
              fontSize: 13,
              color: contextMenu.file?.isAutoexec
                ? "#4ADE80"
                : colors.textWhite,
              cursor: "pointer",
              borderRadius: 8,
              transition: "background 0.15s ease",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = contextMenu.file?.isAutoexec
                ? "rgba(74,222,128,0.1)"
                : "rgba(255,255,255,0.05)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            {contextMenu.file?.isAutoexec ? (
              <Check size={14} />
            ) : (
              <Plus size={14} />
            )}{" "}
            Auto-execute
          </div>
          {onRevealInExplorer && (
            <div
              onClick={handleRevealInExplorer}
              style={{
                padding: "10px 14px",
                fontSize: 13,
                color: colors.textWhite,
                cursor: "pointer",
                borderRadius: 8,
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              Reveal in Explorer
            </div>
          )}
          <div
            onClick={handleDelete}
            style={{
              padding: "10px 14px",
              fontSize: 13,
              color: colors.error,
              cursor: "pointer",
              borderRadius: 8,
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,77,106,0.1)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            Delete
          </div>
        </div>
      )}
    </div>
  );
}
