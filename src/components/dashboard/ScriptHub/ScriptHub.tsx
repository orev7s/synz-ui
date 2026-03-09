import { useState, useCallback, useEffect, useRef } from 'react';
import { colors } from '../../../config/theme';
import { useAccentColor } from '../../../hooks/useAccentColor';
import {
  fetchScripts,
  searchScripts,
  Script,
  SortBy,
  SortOrder,
} from '../../../services/scriptbloxApi';
import { Search, Eye, Key, CheckCircle, Loader2, ChevronLeft, ChevronRight, Copy, Play, X, Globe, AlertTriangle, ChevronDown } from 'lucide-react';

interface ScriptHubProps {
  onExecuteScript: (script: string) => void;
}

interface FilterState {
  verified: boolean | null;
  key: boolean | null;
  patched: boolean | null;
  universal: boolean | null;
  sortBy: SortBy;
  order: SortOrder;
}

function Dropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          padding: '6px 10px',
          background: '#18181d',
          border: '1px solid #2a2a35',
          borderRadius: 6,
          color: colors.textWhite,
          fontSize: 11,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 90,
        }}
      >
        <span style={{ flex: 1, textAlign: 'left' }}>{selectedOption?.label}</span>
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: '#18181d',
            border: '1px solid #2a2a35',
            borderRadius: 6,
            overflow: 'hidden',
            zIndex: 100,
            minWidth: '100%',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          {options.map((option) => (
            <div
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              style={{
                padding: '8px 12px',
                fontSize: 11,
                color: value === option.value ? colors.textWhite : colors.textMuted,
                background: value === option.value ? '#252530' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#252530')}
              onMouseLeave={(e) => (e.currentTarget.style.background = value === option.value ? '#252530' : 'transparent')}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  activeState,
  onClick,
  accent,
}: {
  label: string;
  active: boolean;
  activeState: boolean | null;
  onClick: () => void;
  accent: { primary: string };
}) {
  const [hovered, setHovered] = useState(false);

  const getLabel = () => {
    if (activeState === true) return `✓ ${label}`;
    if (activeState === false) return `✗ ${label}`;
    return label;
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '5px 10px',
        background: active ? accent.primary : hovered ? '#1f1f25' : 'transparent',
        border: '1px solid ' + (active ? accent.primary : '#2a2a35'),
        borderRadius: 5,
        color: active ? '#000' : colors.textMuted,
        fontSize: 11,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      {getLabel()}
    </button>
  );
}

function ScriptCard({
  script,
  accent,
  onCopy,
  onExecute,
}: {
  script: Script;
  accent: { primary: string };
  onCopy: (script: string) => void;
  onExecute: (script: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy(script.script);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleExecute = (e: React.MouseEvent) => {
    e.stopPropagation();
    onExecute(script.script);
  };

  const imageUrl = script.image
    ? script.image.startsWith('http')
      ? script.image
      : `https://scriptblox.com${script.image}`
    : null;

  const gameImageUrl = script.game?.imageUrl
    ? script.game.imageUrl.startsWith('http')
      ? script.game.imageUrl
      : `https://scriptblox.com${script.game.imageUrl}`
    : null;

  const displayImage = !imageError && imageUrl ? imageUrl : (!imageError && gameImageUrl ? gameImageUrl : null);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#111115',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid #1a1a1f',
        transition: 'all 0.15s ease',
        transform: hovered ? 'translateY(-1px)' : 'none',
        boxShadow: hovered ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
      }}
    >
      <div
        style={{
          height: 110,
          background: displayImage ? 'transparent' : '#0a0a0e',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {displayImage ? (
          <img
            src={displayImage}
            alt={script.title}
            onError={() => setImageError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#333',
            }}
          >
            <Globe size={28} strokeWidth={1.5} />
          </div>
        )}

        <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 3 }}>
          {script.verified && (
            <div style={{ background: 'rgba(0,0,0,0.6)', padding: '3px 6px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
              <CheckCircle size={10} color="#4ADE80" />
            </div>
          )}
          {script.key && (
            <div style={{ background: 'rgba(0,0,0,0.6)', padding: '3px 6px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
              <Key size={10} color="#FBBF24" />
            </div>
          )}
          {script.isPatched && (
            <div style={{ background: 'rgba(0,0,0,0.6)', padding: '3px 6px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
              <AlertTriangle size={10} color="#FF4D6A" />
            </div>
          )}
        </div>

        {hovered && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <button
              onClick={handleCopy}
              style={{
                padding: '7px 12px',
                background: '#2a2a35',
                border: 'none',
                borderRadius: 6,
                color: colors.textWhite,
                fontSize: 11,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={handleExecute}
              style={{
                padding: '7px 12px',
                background: accent.primary,
                border: 'none',
                borderRadius: 6,
                color: '#000',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Play size={12} />
              Run
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: 10 }}>
        <h3
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: colors.textWhite,
            marginBottom: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {script.title}
        </h3>

        <p
          style={{
            fontSize: 10,
            color: colors.textMuted,
            marginBottom: 8,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {script.game?.name || (script.isUniversal ? 'Universal' : 'Unknown')}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Eye size={10} color={colors.textMuted} />
          <span style={{ fontSize: 10, color: colors.textMuted }}>
            {script.views >= 1000 ? `${(script.views / 1000).toFixed(1)}K` : script.views}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ScriptHub({ onExecuteScript }: ScriptHubProps) {
  const accent = useAccentColor();
  const [searchQuery, setSearchQuery] = useState('');
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<FilterState>({
    verified: null,
    key: null,
    patched: null,
    universal: null,
    sortBy: 'updatedAt',
    order: 'desc',
  });
const searchTimeoutRef = useRef<number | null>(null);

  const loadScripts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (searchQuery.trim()) {
        const response = await searchScripts({
          q: searchQuery.trim(),
          page,
          max: 20,
          verified: filters.verified === true ? 1 : filters.verified === false ? 0 : undefined,
          key: filters.key === true ? 1 : filters.key === false ? 0 : undefined,
          patched: filters.patched === true ? 1 : filters.patched === false ? 0 : undefined,
          universal: filters.universal === true ? 1 : filters.universal === false ? 0 : undefined,
          sortBy: filters.sortBy,
          order: filters.order,
        });
        setScripts(response.result.scripts);
        setTotalPages(response.result.totalPages);
      } else {
        const response = await fetchScripts({
          page,
          max: 20,
          verified: filters.verified === true ? 1 : filters.verified === false ? 0 : undefined,
          key: filters.key === true ? 1 : filters.key === false ? 0 : undefined,
          patched: filters.patched === true ? 1 : filters.patched === false ? 0 : undefined,
          universal: filters.universal === true ? 1 : filters.universal === false ? 0 : undefined,
          sortBy: filters.sortBy,
          order: filters.order,
        });
        setScripts(response.result.scripts);
        setTotalPages(response.result.totalPages);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scripts');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, page, filters]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      loadScripts();
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [loadScripts]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const toggleFilter = (key: keyof Omit<FilterState, 'sortBy' | 'order'>) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key] === null ? true : prev[key] === true ? false : null,
    }));
    setPage(1);
  };

  const handleCopyScript = (script: string) => {
    navigator.clipboard.writeText(script);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: colors.bgDark }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a1f', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            background: '#111115',
            border: '1px solid #1a1a1f',
            borderRadius: 6,
          }}
        >
          <Search size={14} color={colors.textMuted} />
          <input
            type="text"
            placeholder="Search scripts..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 12,
              color: colors.textWhite,
            }}
          />
          {searchQuery && (
            <button
              onClick={() => handleSearchChange('')}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: colors.textMuted,
                padding: 2,
                display: 'flex',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <FilterChip
            label="Verified"
            active={filters.verified !== null}
            activeState={filters.verified}
            onClick={() => toggleFilter('verified')}
            accent={accent}
          />
          <FilterChip
            label="Key"
            active={filters.key !== null}
            activeState={filters.key}
            onClick={() => toggleFilter('key')}
            accent={accent}
          />
          <FilterChip
            label="Universal"
            active={filters.universal !== null}
            activeState={filters.universal}
            onClick={() => toggleFilter('universal')}
            accent={accent}
          />
          <FilterChip
            label="Patched"
            active={filters.patched !== null}
            activeState={filters.patched}
            onClick={() => toggleFilter('patched')}
            accent={accent}
          />

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <Dropdown
              value={filters.sortBy}
              options={[
                { value: 'updatedAt', label: 'Updated' },
                { value: 'createdAt', label: 'Created' },
                { value: 'views', label: 'Views' },
                { value: 'likeCount', label: 'Likes' },
              ]}
              onChange={(v) => setFilters((prev) => ({ ...prev, sortBy: v as SortBy }))}
            />
            <Dropdown
              value={filters.order}
              options={[
                { value: 'desc', label: 'Desc' },
                { value: 'asc', label: 'Asc' },
              ]}
              onChange={(v) => setFilters((prev) => ({ ...prev, order: v as SortOrder }))}
            />
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
            <Loader2 size={24} color={accent.primary} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 12, color: colors.textMuted }}>Loading...</span>
          </div>
        ) : error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
            <AlertTriangle size={24} color={colors.error} />
            <span style={{ fontSize: 12, color: colors.error }}>{error}</span>
            <button
              onClick={loadScripts}
              style={{
                padding: '6px 12px',
                background: accent.primary,
                border: 'none',
                borderRadius: 6,
                color: '#000',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        ) : scripts.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
            <Search size={32} color="#333" strokeWidth={1} />
            <span style={{ fontSize: 12, color: colors.textMuted }}>No scripts found</span>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            {scripts.map((script) => (
              <ScriptCard
                key={script._id}
                script={script}
                accent={accent}
                onCopy={handleCopyScript}
                onExecute={onExecuteScript}
              />
            ))}
          </div>
        )}
      </div>

      {!loading && !error && scripts.length > 0 && totalPages > 1 && (
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid #1a1a1f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{
              padding: '6px 10px',
              background: page <= 1 ? '#111115' : '#18181d',
              border: '1px solid #1a1a1f',
              borderRadius: 5,
              color: page <= 1 ? '#333' : colors.textMuted,
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
            }}
          >
            <ChevronLeft size={14} />
          </button>

          <span style={{ fontSize: 11, color: colors.textMuted }}>
            {page} / {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{
              padding: '6px 10px',
              background: page >= totalPages ? '#111115' : '#18181d',
              border: '1px solid #1a1a1f',
              borderRadius: 5,
              color: page >= totalPages ? '#333' : colors.textMuted,
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
            }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
