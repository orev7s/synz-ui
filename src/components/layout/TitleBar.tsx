import { useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { colors } from '../../config/theme';
import synapseIcon from '../../assets/icon.png';

interface TitleBarProps {
  title: string;
}

interface WindowButtonProps {
  onClick: () => void;
  tooltip: string;
  children: React.ReactNode;
  isClose?: boolean;
}

function WindowButton({ onClick, tooltip, children, isClose }: WindowButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onClick}
        onMouseEnter={() => {
          setHovered(true);
          setTimeout(() => setShowTooltip(true), 400);
        }}
        onMouseLeave={() => {
          setHovered(false);
          setShowTooltip(false);
        }}
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          background: hovered
            ? isClose
              ? '#FF4D6A'
              : colors.surfaceDark
            : 'transparent',
          color: hovered && isClose ? '#FFF' : colors.textMuted,
          cursor: 'pointer',
          borderRadius: 6,
          transition: 'all 0.15s ease',
        }}
      >
        {children}
      </button>
      {showTooltip && hovered && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: 6,
            padding: '4px 8px',
            background: colors.surfaceDark,
            color: colors.textWhite,
            fontSize: 11,
            borderRadius: 4,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            border: `1px solid ${colors.border}`,
            zIndex: 1000,
          }}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}

export function TitleBar({ title }: TitleBarProps) {
  const appWindow = getCurrentWindow();

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();

  return (
    <div
      data-tauri-drag-region
      style={{
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        background: colors.panelDark,
        borderBottom: `1px solid ${colors.border}`,
        userSelect: 'none',
      }}
    >
      <div
        data-tauri-drag-region
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <img
          src={synapseIcon}
          alt="Synapse Z"
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
          }}
        />
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: colors.textMuted,
          }}
        >
          {title}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        <WindowButton onClick={handleMinimize} tooltip="Minimize">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </WindowButton>

        <WindowButton onClick={handleMaximize} tooltip="Maximize">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="2" y="2" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </WindowButton>

        <WindowButton onClick={handleClose} tooltip="Close" isClose>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </WindowButton>
      </div>
    </div>
  );
}
