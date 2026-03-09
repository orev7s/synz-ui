import { useState, useEffect, useRef, useCallback } from 'react';
import { colors } from '../../config/theme';
import { useAccentColor } from '../../hooks/useAccentColor';
import { fileStore, subscribeToFileStore, VirtualFile } from '../../stores/fileStore';
import { Search, FileCode } from 'lucide-react';

interface QuickFilePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (fileId: string, fileName: string) => void;
}

export function QuickFilePicker({ isOpen, onClose, onFileSelect }: QuickFilePickerProps) {
  const accent = useAccentColor();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [files, setFiles] = useState<VirtualFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateFiles = () => setFiles(fileStore.getAllFiles());
    updateFiles();
    return subscribeToFileStore(updateFiles);
  }, []);

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    if (listRef.current && filteredFiles.length > 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, filteredFiles.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredFiles.length - 1));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredFiles[selectedIndex]) {
          onFileSelect(filteredFiles[selectedIndex].id, filteredFiles[selectedIndex].name);
          onClose();
        }
        return;
      }
    },
    [filteredFiles, selectedIndex, onFileSelect, onClose]
  );

  const handleFileClick = useCallback(
    (file: VirtualFile) => {
      onFileSelect(file.id, file.name);
      onClose();
    },
    [onFileSelect, onClose]
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 100,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 520,
          maxHeight: 400,
          background: '#0c0c10',
          border: '1px solid #2a2a35',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.4)',
        }}
        onKeyDown={handleKeyDown}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px',
            borderBottom: '1px solid #2a2a35',
          }}
        >
          <Search size={18} style={{ color: colors.textMuted, flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search scripts..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 15,
              color: colors.textWhite,
              fontFamily: 'inherit',
            }}
          />
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: '4px 8px',
              background: '#1a1a22',
              borderRadius: 6,
              fontSize: 11,
              color: colors.textMuted,
            }}
          >
            <span>ESC</span>
          </div>
        </div>

        <div
          ref={listRef}
          style={{
            maxHeight: 320,
            overflowY: 'auto',
          }}
        >
          {filteredFiles.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: colors.textMuted,
                fontSize: 13,
              }}
            >
              {searchQuery ? 'No scripts found' : 'No scripts available'}
            </div>
          ) : (
            filteredFiles.map((file, index) => (
              <div
                key={file.id}
                onClick={() => handleFileClick(file)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 16px',
                  cursor: 'pointer',
                  background: index === selectedIndex ? `${accent.primary}15` : 'transparent',
                  borderLeft: index === selectedIndex ? `2px solid ${accent.primary}` : '2px solid transparent',
                  transition: 'all 0.1s ease',
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <FileCode
                  size={16}
                  style={{
                    color: index === selectedIndex ? accent.primary : colors.textMuted,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: index === selectedIndex ? colors.textWhite : colors.textMuted,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {highlightMatch(file.name, searchQuery)}
                  </div>
                </div>
                {index === selectedIndex && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 4,
                      padding: '2px 6px',
                      background: '#1a1a22',
                      borderRadius: 4,
                      fontSize: 10,
                      color: colors.textMuted,
                    }}
                  >
                    <span>ENTER</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {filteredFiles.length > 0 && (
          <div
            style={{
              padding: '8px 16px',
              borderTop: '1px solid #2a2a35',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 11,
              color: colors.textMuted,
            }}
          >
            <span>{filteredFiles.length} scripts</span>
            <div style={{ display: 'flex', gap: 12 }}>
              <span>↑↓ Navigate</span>
              <span>↵ Open</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return text;

  return (
    <>
      {text.slice(0, index)}
      <span style={{ color: '#FFFFFF', fontWeight: 600 }}>
        {text.slice(index, index + query.length)}
      </span>
      {text.slice(index + query.length)}
    </>
  );
}
