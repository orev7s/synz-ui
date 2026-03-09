import { colors } from '../../config/theme';
import { Code } from 'lucide-react';

interface DragGhostProps {
  title: string;
  x: number;
  y: number;
}

export function DragGhost({ title, x, y }: DragGhostProps) {
  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        zIndex: 10000,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        background: '#18181d',
        border: `1px solid ${colors.primary}`,
        borderRadius: 8,
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05), 0 0 20px ${colors.primary}30`,
        animation: 'dragGhostAppear 0.15s ease-out',
      }}
    >
      <Code size={14} color={colors.primary} />
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: colors.textWhite,
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </span>
      <style>
        {`
          @keyframes dragGhostAppear {
            from {
              opacity: 0;
              transform: translate(-50%, -50%) scale(0.9);
            }
            to {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1);
            }
          }
        `}
      </style>
    </div>
  );
}
