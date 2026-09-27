import React, { useEffect } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { Play, Pause, Scissors, Crop, ZoomIn, ZoomOut, SkipBack, Ratio } from 'lucide-react';
import type { ProjectSettings } from '../../types/project';

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
};

export const PlaybackControls: React.FC = () => {
  const {
    project,
    currentTime,
    setCurrentTime,
    isPlaying,
    togglePlay,
    isCropMode,
    setIsCropMode,
    splitClipAtPlayhead,
    timelineZoom,
    setTimelineZoom,
    setAspectRatio,
  } = useProjectStore();

  // Total timeline duration
  const totalDuration = (project?.timeline || []).reduce((acc, c) => acc + (c.trimEnd - c.trimStart), 0);

  // Keyboard shortcuts: Space for Play/Pause, S for Split
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        splitClipAtPlayhead();
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setIsCropMode(!isCropMode);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, splitClipAtPlayhead, isCropMode, setIsCropMode]);

  return (
    <div
      style={{
        height: 52,
        backgroundColor: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-default)',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        gap: 16,
      }}
    >
      {/* Left: Aspect Ratio & Tools */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Aspect Ratio selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Ratio size={15} color="var(--text-muted)" />
          <select
            value={project?.settings.aspectRatio || '16:9'}
            onChange={(e) => setAspectRatio(e.target.value as ProjectSettings['aspectRatio'])}
            style={{ fontSize: 11, padding: '3px 8px' }}
            title="Relación de aspecto del proyecto"
          >
            <option value="16:9">16:9 Horizontal</option>
            <option value="9:16">9:16 Vertical</option>
            <option value="1:1">1:1 Cuadrado</option>
            <option value="4:5">4:5 Retrato</option>
            <option value="Original">Original</option>
            <option value="Libre">Libre</option>
          </select>
        </div>

        {/* Visual Crop Toggle */}
        <button
          onClick={() => setIsCropMode(!isCropMode)}
          className={isCropMode ? 'btn-primary' : 'btn-secondary'}
          style={{
            fontSize: 11,
            padding: '4px 10px',
            backgroundColor: isCropMode ? 'var(--accent-primary)' : undefined,
            color: isCropMode ? '#050b14' : undefined,
          }}
          title="Herramienta de Recorte Visual (C)"
        >
          <Crop size={14} />
          <span>CROP</span>
        </button>

        {/* Split Clip Button */}
        <button
          onClick={splitClipAtPlayhead}
          className="btn-secondary"
          style={{ fontSize: 11, padding: '4px 10px' }}
          title="Dividir clip en el playhead (S)"
          disabled={!project || project.timeline.length === 0}
        >
          <Scissors size={14} />
          <span>Dividir</span>
        </button>
      </div>

      {/* Center: Play/Pause & Time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => setCurrentTime(0)}
          className="btn-ghost"
          title="Ir al inicio"
        >
          <SkipBack size={16} />
        </button>

        <button
          onClick={togglePlay}
          className="btn-primary"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            padding: 0,
          }}
          title={isPlaying ? 'Pausar (Espacio)' : 'Reproducir (Espacio)'}
        >
          {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" style={{ marginLeft: 2 }} />}
        </button>

        {/* Time display */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--text-primary)',
          backgroundColor: 'var(--bunker-950)',
          padding: '4px 8px',
          borderRadius: 4,
          border: '1px solid var(--border-subtle)',
        }}>
          <span>{formatTime(currentTime)}</span>
          <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>/</span>
          <span style={{ color: 'var(--text-secondary)' }}>{formatTime(totalDuration)}</span>
        </div>
      </div>

      {/* Right: Timeline Zoom */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => setTimelineZoom(timelineZoom - 15)}
          className="btn-ghost"
          style={{ padding: 4 }}
          title="Alejar zoom"
        >
          <ZoomOut size={15} />
        </button>
        <input
          type="range"
          min={20}
          max={150}
          value={timelineZoom}
          onChange={(e) => setTimelineZoom(Number(e.target.value))}
          style={{ width: 80, accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
          title="Zoom de la línea de tiempo"
        />
        <button
          onClick={() => setTimelineZoom(timelineZoom + 15)}
          className="btn-ghost"
          style={{ padding: 4 }}
          title="Acercar zoom"
        >
          <ZoomIn size={15} />
        </button>
      </div>
    </div>
  );
};
