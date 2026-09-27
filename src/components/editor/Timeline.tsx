import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { Trash2, Crop as CropIcon } from 'lucide-react';

export const Timeline: React.FC = () => {
  const {
    project,
    currentTime,
    setCurrentTime,
    activeClipId,
    setActiveClipId,
    updateClip,
    removeClip,
    moveClip,
    timelineZoom,
  } = useProjectStore();

  const timelineRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Dragging state for trimming or scrubbing
  const [trimDrag, setTrimDrag] = useState<{
    clipId: string;
    type: 'start' | 'end';
    startX: number;
    initialTrimStart: number;
    initialTrimEnd: number;
    maxDuration: number;
  } | null>(null);

  const [isScrubbing, setIsScrubbing] = useState(false);
  const [draggedClipIndex, setDraggedClipIndex] = useState<number | null>(null);

  // Compute accumulated layout for clips
  const clipPositions = useMemo(() => {
    if (!project) return [];
    let currentX = 0;
    return project.timeline.map((clip, index) => {
      const media = project.media.find((m) => m.id === clip.mediaId);
      const clipDuration = Math.max(0.1, clip.trimEnd - clip.trimStart);
      const width = clipDuration * timelineZoom;
      const left = currentX;
      currentX += width;

      return {
        clip,
        media,
        index,
        left,
        width,
        duration: clipDuration,
      };
    });
  }, [project, timelineZoom]);

  const totalDuration = clipPositions.reduce((acc, c) => acc + c.duration, 0);
  const totalTrackWidth = Math.max(800, totalDuration * timelineZoom + 200);

  // Playhead position in pixels
  const playheadX = currentTime * timelineZoom;

  // Handle Trim Dragging
  const handleTrimMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!trimDrag) return;

      const deltaPixels = e.clientX - trimDrag.startX;
      const deltaSeconds = deltaPixels / timelineZoom;

      if (trimDrag.type === 'start') {
        const newTrimStart = Math.max(
          0,
          Math.min(trimDrag.initialTrimEnd - 0.2, trimDrag.initialTrimStart + deltaSeconds)
        );
        updateClip(trimDrag.clipId, { trimStart: newTrimStart });
      } else {
        const newTrimEnd = Math.max(
          trimDrag.initialTrimStart + 0.2,
          Math.min(trimDrag.maxDuration, trimDrag.initialTrimEnd + deltaSeconds)
        );
        updateClip(trimDrag.clipId, { trimEnd: newTrimEnd });
      }
    },
    [trimDrag, timelineZoom, updateClip]
  );

  const handleTrimMouseUp = useCallback(() => {
    setTrimDrag(null);
  }, []);

  useEffect(() => {
    if (trimDrag) {
      window.addEventListener('mousemove', handleTrimMouseMove);
      window.addEventListener('mouseup', handleTrimMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleTrimMouseMove);
        window.removeEventListener('mouseup', handleTrimMouseUp);
      };
    }
  }, [trimDrag, handleTrimMouseMove, handleTrimMouseUp]);

  // Handle Scrubbing Playhead
  const handleScrub = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const newTime = Math.max(0, clickX / timelineZoom);
      setCurrentTime(newTime);
    },
    [timelineZoom, setCurrentTime]
  );

  const handleRulerMouseDown = (e: React.MouseEvent) => {
    setIsScrubbing(true);
    handleScrub(e.clientX);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isScrubbing) {
        handleScrub(e.clientX);
      }
    };
    const handleMouseUp = () => {
      setIsScrubbing(false);
    };

    if (isScrubbing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isScrubbing, handleScrub]);

  // Delete key handler for selected clip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && activeClipId) {
        removeClip(activeClipId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeClipId, removeClip]);

  // Generate tick markers for ruler
  const rulerTicks = useMemo(() => {
    const ticks: { time: number; label?: string }[] = [];
    // Adjust step based on zoom
    const step = timelineZoom >= 100 ? 1 : timelineZoom >= 40 ? 5 : 10;
    const maxSec = Math.ceil(totalDuration + 60);

    for (let sec = 0; sec <= maxSec; sec += step) {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      ticks.push({
        time: sec,
        label: `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`,
      });
    }
    return ticks;
  }, [totalDuration, timelineZoom]);

  return (
    <div
      ref={timelineRef}
      style={{
        height: 180,
        backgroundColor: 'var(--bg-app)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflowX: 'auto',
        overflowY: 'hidden',
      }}
    >
      <div
        ref={trackRef}
        style={{
          width: totalTrackWidth,
          minWidth: '100%',
          height: '100%',
          position: 'relative',
        }}
      >
        {/* Time Ruler */}
        <div
          onMouseDown={handleRulerMouseDown}
          style={{
            height: 28,
            backgroundColor: 'var(--bunker-900)',
            borderBottom: '1px solid var(--border-default)',
            position: 'relative',
            cursor: 'pointer',
          }}
        >
          {rulerTicks.map((tick) => (
            <div
              key={tick.time}
              style={{
                position: 'absolute',
                left: tick.time * timelineZoom,
                top: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                borderLeft: '1px solid var(--bunker-700)',
                paddingLeft: 4,
                fontSize: 10,
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            >
              {tick.label}
            </div>
          ))}
        </div>

        {/* Tracks Area */}
        <div
          style={{
            height: 152,
            padding: '16px 0',
            position: 'relative',
          }}
          onMouseDown={(e) => {
            // Clicking empty track area moves playhead
            if (e.target === e.currentTarget) {
              handleScrub(e.clientX);
            }
          }}
        >
          {clipPositions.map(({ clip, media, index, left, width, duration }) => {
            const isSelected = clip.id === activeClipId;
            const hasCrop = clip.crop !== null;

            return (
              <div
                key={clip.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveClipId(clip.id);
                }}
                draggable
                onDragStart={() => setDraggedClipIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggedClipIndex !== null && draggedClipIndex !== index) {
                    moveClip(clip.id, draggedClipIndex);
                    setDraggedClipIndex(null);
                  }
                }}
                style={{
                  position: 'absolute',
                  left,
                  top: 20,
                  width: Math.max(30, width),
                  height: 84,
                  backgroundColor: isSelected ? 'var(--bunker-700)' : 'var(--bunker-800)',
                  border: isSelected
                    ? '2px solid var(--accent-primary)'
                    : '1px solid var(--border-default)',
                  borderRadius: 6,
                  cursor: 'grab',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  boxShadow: isSelected ? '0 0 10px rgba(56, 189, 248, 0.25)' : 'none',
                  overflow: 'hidden',
                  zIndex: isSelected ? 10 : 2,
                }}
              >
                {/* Left Trim Handle */}
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setTrimDrag({
                      clipId: clip.id,
                      type: 'start',
                      startX: e.clientX,
                      initialTrimStart: clip.trimStart,
                      initialTrimEnd: clip.trimEnd,
                      maxDuration: media?.duration || 100,
                    });
                  }}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 10,
                    backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--bunker-600)',
                    cursor: 'ew-resize',
                    zIndex: 20,
                  }}
                  title="Arrastrar para recortar inicio"
                />

                {/* Right Trim Handle */}
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setTrimDrag({
                      clipId: clip.id,
                      type: 'end',
                      startX: e.clientX,
                      initialTrimStart: clip.trimStart,
                      initialTrimEnd: clip.trimEnd,
                      maxDuration: media?.duration || 100,
                    });
                  }}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: 10,
                    backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--bunker-600)',
                    cursor: 'ew-resize',
                    zIndex: 20,
                  }}
                  title="Arrastrar para recortar final"
                />

                {/* Clip Header / Info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none' }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '80%',
                  }}>
                    {media?.fileName || 'Clip'}
                  </span>

                  {hasCrop && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 2,
                      fontSize: 9,
                      padding: '1px 4px',
                      borderRadius: 3,
                      backgroundColor: 'rgba(56, 189, 248, 0.2)',
                      color: 'var(--accent-primary)',
                      fontWeight: 600,
                    }}>
                      <CropIcon size={9} /> CROP
                    </span>
                  )}
                </div>

                {/* Subtle Filmstrip Pattern */}
                <div style={{
                  height: 24,
                  backgroundColor: 'rgba(0,0,0,0.25)',
                  borderRadius: 3,
                  backgroundImage: 'radial-gradient(circle, var(--bunker-900) 2px, transparent 2px)',
                  backgroundSize: '12px 12px',
                  pointerEvents: 'none',
                }} />

                {/* Clip Duration Badge & Delete button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)', pointerEvents: 'none' }}>
                    {duration.toFixed(1)}s (Trim: {clip.trimStart.toFixed(1)}s - {clip.trimEnd.toFixed(1)}s)
                  </span>

                  {isSelected && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeClip(clip.id);
                      }}
                      className="btn-ghost"
                      style={{ padding: 2, color: 'var(--danger)' }}
                      title="Eliminar clip (Supr)"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Red Playhead line */}
          <div
            style={{
              position: 'absolute',
              left: playheadX,
              top: 0,
              bottom: 0,
              width: 2,
              backgroundColor: '#ef4444',
              zIndex: 30,
              pointerEvents: 'none',
              boxShadow: '0 0 6px rgba(239, 68, 68, 0.8)',
            }}
          >
            {/* Playhead Head Marker */}
            <div
              style={{
                position: 'absolute',
                top: -6,
                left: -5,
                width: 12,
                height: 12,
                backgroundColor: '#ef4444',
                transform: 'rotate(45deg)',
                borderRadius: 2,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
