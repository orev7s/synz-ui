import { useState, useRef, useEffect, useCallback } from 'react';

interface FloatingExecuteButtonProps {
  onExecute: () => void;
}

interface Position {
  x: number;
  y: number;
}

const STORAGE_KEY = 'synapsez_floating_btn_pos';

function loadPosition(): Position | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

function savePosition(pos: Position): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {}
}

export function FloatingExecuteButton({ onExecute }: FloatingExecuteButtonProps) {
  const [position, setPosition] = useState<Position>(() => loadPosition() || { x: 40, y: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [runHovered, setRunHovered] = useState(false);
  const dragOffset = useRef<Position>({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

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
      const newX = e.clientX - dragOffset.current.x;
      const newY = e.clientY - dragOffset.current.y;
      const maxX = window.innerWidth - 120;
      const maxY = window.innerHeight - 50;
      setPosition({
        x: Math.max(0, Math.min(maxX, newX)),
        y: Math.max(44, Math.min(maxY, newY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      savePosition(position);
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

  return (
    <div
      ref={cardRef}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 9999,
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
  );
}
