import { useState, ReactNode, CSSProperties } from 'react';
import { colors } from '../../config/theme';

interface IconButtonProps {
  onClick?: () => void;
  tooltip?: string;
  children: ReactNode;
  size?: number;
  style?: CSSProperties;
  disabled?: boolean;
  active?: boolean;
}

export function IconButton({
  onClick,
  tooltip,
  children,
  size = 28,
  style,
  disabled,
  active,
}: IconButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={() => {
          setHovered(true);
          if (tooltip) setTimeout(() => setShowTooltip(true), 400);
        }}
        onMouseLeave={() => {
          setHovered(false);
          setShowTooltip(false);
        }}
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          background: hovered || active ? '#18181d' : 'transparent',
          color: hovered || active ? colors.textWhite : colors.textMuted,
          cursor: disabled ? 'not-allowed' : 'pointer',
          borderRadius: 6,
          transition: 'all 0.15s ease',
          opacity: disabled ? 0.5 : 1,
          ...style,
        }}
      >
        {children}
      </button>
      {showTooltip && hovered && tooltip && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: 6,
            padding: '4px 8px',
            background: '#18181d',
            color: colors.textWhite,
            fontSize: 11,
            borderRadius: 4,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            border: '1px solid #1a1a1f',
            zIndex: 1000,
          }}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}
