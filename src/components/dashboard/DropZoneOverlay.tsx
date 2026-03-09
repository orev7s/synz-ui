import { useState, useCallback, useEffect, useRef } from 'react';
import { colors } from '../../config/theme';
import { DropZone } from '../../stores/splitStore';

interface DropZoneOverlayProps {
  isDragging: boolean;
  onDrop: (zone: DropZone) => void;
}

interface ZoneConfig {
  zone: DropZone;
  style: React.CSSProperties;
  previewStyle: React.CSSProperties;
}

const ZONE_CONFIGS: ZoneConfig[] = [
  {
    zone: 'top',
    style: {
      top: 0,
      left: '20%',
      right: '20%',
      height: '25%',
    },
    previewStyle: {
      top: 0,
      left: 0,
      right: 0,
      height: '50%',
    },
  },
  {
    zone: 'right',
    style: {
      top: '20%',
      right: 0,
      bottom: '20%',
      width: '25%',
    },
    previewStyle: {
      top: 0,
      right: 0,
      bottom: 0,
      width: '50%',
    },
  },
  {
    zone: 'bottom',
    style: {
      bottom: 0,
      left: '20%',
      right: '20%',
      height: '25%',
    },
    previewStyle: {
      bottom: 0,
      left: 0,
      right: 0,
      height: '50%',
    },
  },
  {
    zone: 'left',
    style: {
      top: '20%',
      left: 0,
      bottom: '20%',
      width: '25%',
    },
    previewStyle: {
      top: 0,
      left: 0,
      bottom: 0,
      width: '50%',
    },
  },
  {
    zone: 'center',
    style: {
      top: '30%',
      left: '30%',
      right: '30%',
      bottom: '30%',
    },
    previewStyle: {
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
  },
];

interface DropZoneIndicatorProps {
  config: ZoneConfig;
  isHovered: boolean;
  onHover: (zone: DropZone | null) => void;
  onDrop: () => void;
}

function DropZoneIndicator({ config, isHovered, onHover, onDrop }: DropZoneIndicatorProps) {
  return (
    <div
      onMouseEnter={() => onHover(config.zone)}
      onMouseLeave={() => onHover(null)}
      onMouseUp={onDrop}
      style={{
        position: 'absolute',
        ...config.style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: config.zone === 'center' ? 60 : config.zone === 'top' || config.zone === 'bottom' ? '60%' : 40,
          height: config.zone === 'center' ? 60 : config.zone === 'left' || config.zone === 'right' ? '60%' : 40,
          borderRadius: config.zone === 'center' ? 12 : 8,
          background: isHovered ? `${colors.primary}40` : 'rgba(255,255,255,0.08)',
          border: `2px dashed ${isHovered ? colors.primary : 'rgba(255,255,255,0.2)'}`,
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width={config.zone === 'center' ? 24 : 20}
          height={config.zone === 'center' ? 24 : 20}
          viewBox="0 0 24 24"
          fill="none"
          style={{
            transform:
              config.zone === 'top'
                ? 'rotate(0deg)'
                : config.zone === 'right'
                ? 'rotate(90deg)'
                : config.zone === 'bottom'
                ? 'rotate(180deg)'
                : config.zone === 'left'
                ? 'rotate(-90deg)'
                : 'none',
            opacity: isHovered ? 1 : 0.5,
            transition: 'opacity 0.2s ease',
          }}
        >
          {config.zone === 'center' ? (
            <rect
              x="4"
              y="4"
              width="16"
              height="16"
              rx="2"
              stroke={isHovered ? colors.primary : 'white'}
              strokeWidth="2"
            />
          ) : (
            <path
              d="M12 5L12 19M12 5L7 10M12 5L17 10"
              stroke={isHovered ? colors.primary : 'white'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </div>
    </div>
  );
}

export function DropZoneOverlay({ isDragging, onDrop }: DropZoneOverlayProps) {
  const [hoveredZone, setHoveredZone] = useState<DropZone | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleDrop = useCallback(
    (zone: DropZone) => {
      onDrop(zone);
      setHoveredZone(null);
    },
    [onDrop]
  );

  useEffect(() => {
    if (!isDragging) {
      setHoveredZone(null);
    }
  }, [isDragging]);

  if (!isDragging) return null;

  const hoveredConfig = ZONE_CONFIGS.find((c) => c.zone === hoveredZone);

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {hoveredZone && hoveredConfig && (
        <div
          style={{
            position: 'absolute',
            ...hoveredConfig.previewStyle,
            background: `${colors.primary}15`,
            border: `2px solid ${colors.primary}60`,
            borderRadius: 8,
            transition: 'all 0.2s ease',
            pointerEvents: 'none',
          }}
        />
      )}

      {ZONE_CONFIGS.map((config) => (
        <DropZoneIndicator
          key={config.zone}
          config={config}
          isHovered={hoveredZone === config.zone}
          onHover={setHoveredZone}
          onDrop={() => handleDrop(config.zone)}
        />
      ))}
    </div>
  );
}
