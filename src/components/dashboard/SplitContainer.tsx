import { useState, useRef, useCallback } from 'react';
import { SplitNode, updateSplitRatio } from '../../stores/splitStore';

interface SplitContainerProps {
  node: SplitNode;
  renderPane: (paneId: string) => React.ReactNode;
}

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
}

function ResizeHandle({ direction, onResize }: ResizeHandleProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startPos.current = direction === 'horizontal' ? e.clientX : e.clientY;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const currentPos = direction === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
        const delta = currentPos - startPos.current;
        startPos.current = currentPos;
        onResize(delta);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [direction, onResize]
  );

  const isVertical = direction === 'vertical';

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        width: isVertical ? '100%' : 6,
        height: isVertical ? 6 : '100%',
        cursor: isVertical ? 'row-resize' : 'col-resize',
        background: 'transparent',
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: isVertical ? 0 : '50%',
          top: isVertical ? '50%' : 0,
          transform: isVertical ? 'translateY(-50%)' : 'translateX(-50%)',
          width: isVertical ? '100%' : 1,
          height: isVertical ? 1 : '100%',
          background: isHovered || isDragging ? '#3a3a45' : '#1a1a1f',
          boxShadow: isHovered || isDragging 
            ? 'inset 0 0 4px rgba(0,0,0,0.4)' 
            : 'none',
          transition: 'all 0.15s ease',
        }}
      />
    </div>
  );
}

export function SplitContainer({ node, renderPane }: SplitContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleResize = useCallback(
    (delta: number) => {
      if (!containerRef.current || !node.children || node.children.length < 2) return;

      const rect = containerRef.current.getBoundingClientRect();
      const totalSize = node.direction === 'horizontal' ? rect.width : rect.height;
      const deltaRatio = delta / totalSize;

      const currentRatio = node.children[0].ratio ?? 0.5;
      const newRatio = Math.min(0.85, Math.max(0.15, currentRatio + deltaRatio));

      updateSplitRatio(node.id, newRatio);
    },
    [node.id, node.direction, node.children]
  );

  if (node.type === 'pane' && node.pane) {
    return <>{renderPane(node.pane.id)}</>;
  }

  if (node.type === 'split' && node.children && node.children.length >= 2) {
    const isHorizontal = node.direction === 'horizontal';

    return (
      <div
        ref={containerRef}
        style={{
          display: 'flex',
          flexDirection: isHorizontal ? 'row' : 'column',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        {node.children.map((child, index) => (
          <div key={child.id} style={{ display: 'contents' }}>
            <div
              style={{
                flex: `${(child.ratio ?? 0.5) * 100} 0 0`,
                minWidth: isHorizontal ? 100 : undefined,
                minHeight: isHorizontal ? undefined : 100,
                overflow: 'hidden',
                display: 'flex',
              }}
            >
              <SplitContainer node={child} renderPane={renderPane} />
            </div>
            {index < node.children!.length - 1 && (
              <ResizeHandle
                direction={node.direction!}
                onResize={handleResize}
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  return null;
}
