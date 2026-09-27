import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { CropArea } from '../../types/project';
import { RotateCcw } from 'lucide-react';

interface CropOverlayProps {
  crop: CropArea | null;
  onCropChange: (crop: CropArea | null) => void;
  aspectRatioLock?: number | null; // e.g. 16/9, 9/16, 1, or null for free
}

export const CropOverlay: React.FC<CropOverlayProps> = ({
  crop,
  onCropChange,
  aspectRatioLock = null,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Active dragging state
  const [dragState, setDragState] = useState<{
    handle: string; // 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'
    startX: number;
    startY: number;
    initialCrop: CropArea;
  } | null>(null);

  // Default full crop if none
  const currentCrop: CropArea = crop || { x: 0, y: 0, width: 1, height: 1 };

  const handleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState({
      handle,
      startX: e.clientX,
      startY: e.clientY,
      initialCrop: { ...currentCrop },
    });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragState || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = (e.clientX - dragState.startX) / rect.width;
      const deltaY = (e.clientY - dragState.startY) / rect.height;

      const { handle, initialCrop } = dragState;
      let newX = initialCrop.x;
      let newY = initialCrop.y;
      let newW = initialCrop.width;
      let newH = initialCrop.height;

      if (handle === 'move') {
        newX = Math.max(0, Math.min(1 - newW, initialCrop.x + deltaX));
        newY = Math.max(0, Math.min(1 - newH, initialCrop.y + deltaY));
      } else {
        // Resizing
        if (handle.includes('w')) {
          const maxDelta = initialCrop.width - 0.1;
          const clampedDelta = Math.min(maxDelta, Math.max(-initialCrop.x, deltaX));
          newX = initialCrop.x + clampedDelta;
          newW = initialCrop.width - clampedDelta;
        }
        if (handle.includes('e')) {
          newW = Math.max(0.1, Math.min(1 - initialCrop.x, initialCrop.width + deltaX));
        }
        if (handle.includes('n')) {
          const maxDelta = initialCrop.height - 0.1;
          const clampedDelta = Math.min(maxDelta, Math.max(-initialCrop.y, deltaY));
          newY = initialCrop.y + clampedDelta;
          newH = initialCrop.height - clampedDelta;
        }
        if (handle.includes('s')) {
          newH = Math.max(0.1, Math.min(1 - initialCrop.y, initialCrop.height + deltaY));
        }

        // Apply aspect ratio lock if requested
        if (aspectRatioLock && handle !== 'move') {
          // Adjust width or height to preserve ratio
          // ratio = (width * rect.width) / (height * rect.height)
          const targetW = (newH * rect.height * aspectRatioLock) / rect.width;
          if (targetW <= 1 - newX) {
            newW = targetW;
          } else {
            newH = (newW * rect.width) / (rect.height * aspectRatioLock);
          }
        }
      }

      onCropChange({
        x: Math.max(0, Math.min(1, newX)),
        y: Math.max(0, Math.min(1, newY)),
        width: Math.max(0.05, Math.min(1, newW)),
        height: Math.max(0.05, Math.min(1, newH)),
      });
    },
    [dragState, onCropChange, aspectRatioLock]
  );

  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);

  const handleStyle = (pos: string): React.CSSProperties => {
    const size = 12;
    const base: React.CSSProperties = {
      position: 'absolute',
      width: size,
      height: size,
      backgroundColor: '#ffffff',
      border: '2px solid var(--accent-primary)',
      borderRadius: '50%',
      zIndex: 20,
      boxShadow: '0 0 4px rgba(0,0,0,0.5)',
    };

    switch (pos) {
      case 'nw': return { ...base, top: -size / 2, left: -size / 2, cursor: 'nwse-resize' };
      case 'n':  return { ...base, top: -size / 2, left: `calc(50% - ${size / 2}px)`, cursor: 'ns-resize' };
      case 'ne': return { ...base, top: -size / 2, right: -size / 2, cursor: 'nesw-resize' };
      case 'e':  return { ...base, top: `calc(50% - ${size / 2}px)`, right: -size / 2, cursor: 'ew-resize' };
      case 'se': return { ...base, bottom: -size / 2, right: -size / 2, cursor: 'nwse-resize' };
      case 's':  return { ...base, bottom: -size / 2, left: `calc(50% - ${size / 2}px)`, cursor: 'ns-resize' };
      case 'sw': return { ...base, bottom: -size / 2, left: -size / 2, cursor: 'nesw-resize' };
      case 'w':  return { ...base, top: `calc(50% - ${size / 2}px)`, left: -size / 2, cursor: 'ew-resize' };
      default:   return base;
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        pointerEvents: 'auto',
      }}
    >
      {/* Darkened mask around the crop area */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        <defs>
          <mask id="crop-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={`${currentCrop.x * 100}%`}
              y={`${currentCrop.y * 100}%`}
              width={`${currentCrop.width * 100}%`}
              height={`${currentCrop.height * 100}%`}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.65)"
          mask="url(#crop-mask)"
        />
      </svg>

      {/* The interactive crop bounding box */}
      <div
        onMouseDown={(e) => handleMouseDown(e, 'move')}
        style={{
          position: 'absolute',
          left: `${currentCrop.x * 100}%`,
          top: `${currentCrop.y * 100}%`,
          width: `${currentCrop.width * 100}%`,
          height: `${currentCrop.height * 100}%`,
          border: '2px solid var(--accent-primary)',
          cursor: 'move',
          boxSizing: 'border-box',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
        }}
      >
        {/* Rule of thirds grid lines */}
        <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.25)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.25)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.25)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.25)', pointerEvents: 'none' }} />

        {/* 8 Drag handles */}
        {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const).map((pos) => (
          <div
            key={pos}
            style={handleStyle(pos)}
            onMouseDown={(e) => handleMouseDown(e, pos)}
          />
        ))}

        {/* Floating Reset Crop Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCropChange(null);
          }}
          className="btn-secondary"
          style={{
            position: 'absolute',
            bottom: -32,
            right: 0,
            fontSize: 11,
            padding: '2px 8px',
            backgroundColor: 'var(--bunker-900)',
            borderColor: 'var(--border-default)',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
          }}
          title="Restablecer recorte a tamaño completo"
        >
          <RotateCcw size={12} />
          Resetear Crop
        </button>
      </div>
    </div>
  );
};
