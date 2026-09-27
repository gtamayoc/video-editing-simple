import React, { useRef, useEffect, useMemo } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { getVideoAssetUrl } from '../../lib/tauriApi';
import { CropOverlay } from './CropOverlay';
import type { CropArea, Clip } from '../../types/project';
import { Film } from 'lucide-react';

export const VideoPreview: React.FC = () => {
  const {
    project,
    currentTime,
    setCurrentTime,
    isPlaying,
    setIsPlaying,
    activeClipId,
    setActiveClipId,
    isCropMode,
    setClipCrop,
  } = useProjectStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute timeline layout and find the active clip at `currentTime`
  const { currentClipInfo, totalDuration } = useMemo(() => {
    if (!project || project.timeline.length === 0) {
      return { currentClipInfo: null, totalDuration: 0 };
    }

    let accumulated = 0;
    let foundClip: {
      clip: Clip;
      media: (typeof project.media)[0];
      timelineStart: number;
      timelineEnd: number;
      duration: number;
    } | null = null;

    for (const clip of project.timeline) {
      const media = project.media.find((m) => m.id === clip.mediaId);
      if (!media) continue;

      const clipDuration = Math.max(0.1, clip.trimEnd - clip.trimStart);
      const start = accumulated;
      const end = accumulated + clipDuration;

      if (currentTime >= start && currentTime <= end) {
        foundClip = {
          clip,
          media,
          timelineStart: start,
          timelineEnd: end,
          duration: clipDuration,
        };
      }
      accumulated = end;
    }

    // If currentTime is past the end or at 0 and none matched
    if (!foundClip && project.timeline.length > 0) {
      const firstClip = project.timeline[0];
      const media = project.media.find((m) => m.id === firstClip.mediaId);
      if (media) {
        foundClip = {
          clip: firstClip,
          media,
          timelineStart: 0,
          timelineEnd: firstClip.trimEnd - firstClip.trimStart,
          duration: firstClip.trimEnd - firstClip.trimStart,
        };
      }
    }

    return { currentClipInfo: foundClip, totalDuration: accumulated };
  }, [project, currentTime]);

  // Keep activeClipId in sync with current clip
  useEffect(() => {
    if (currentClipInfo && activeClipId !== currentClipInfo.clip.id) {
      setActiveClipId(currentClipInfo.clip.id);
    }
  }, [currentClipInfo, activeClipId, setActiveClipId]);

  // Sincronizar vídeo con el playhead
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentClipInfo) return;

    const offsetInClip = Math.max(0, currentTime - currentClipInfo.timelineStart);
    const targetSourceTime = currentClipInfo.clip.trimStart + offsetInClip;

    if (Math.abs(video.currentTime - targetSourceTime) > 0.15) {
      video.currentTime = targetSourceTime;
    }
  }, [currentTime, currentClipInfo]);

  // Sincronizar estado de reproducción
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch((err) => {
        console.warn('Playback play error:', err);
        setIsPlaying(false);
      });
    } else {
      video.pause();
    }
  }, [isPlaying, setIsPlaying]);

  // On video time update while playing
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !isPlaying || !currentClipInfo) return;

    const currentSourceTime = video.currentTime;
    if (currentSourceTime >= currentClipInfo.clip.trimEnd) {
      // Move to next clip or stop
      const nextTime = currentClipInfo.timelineEnd;
      if (nextTime >= totalDuration) {
        setIsPlaying(false);
        setCurrentTime(0);
      } else {
        setCurrentTime(nextTime);
      }
    } else {
      const offset = currentSourceTime - currentClipInfo.clip.trimStart;
      setCurrentTime(currentClipInfo.timelineStart + offset);
    }
  };

  // Calculate aspect ratio string for CSS
  const aspectRatioCss = useMemo(() => {
    const ratio = project?.settings.aspectRatio || '16:9';
    switch (ratio) {
      case '16:9': return '16 / 9';
      case '9:16': return '9 / 16';
      case '1:1': return '1 / 1';
      case '4:5': return '4 / 5';
      case 'Original':
        if (currentClipInfo?.media) {
          return `${currentClipInfo.media.width} / ${currentClipInfo.media.height}`;
        }
        return '16 / 9';
      default:
        return 'auto';
    }
  }, [project?.settings.aspectRatio, currentClipInfo]);

  // Aspect ratio lock for Crop tool
  const cropRatioLock = useMemo(() => {
    const ratio = project?.settings.aspectRatio || '16:9';
    switch (ratio) {
      case '16:9': return 16 / 9;
      case '9:16': return 9 / 16;
      case '1:1': return 1;
      case '4:5': return 4 / 5;
      default: return null;
    }
  }, [project?.settings.aspectRatio]);

  const activeCrop = currentClipInfo?.clip.crop || null;

  const handleCropChange = (newCrop: CropArea | null) => {
    if (currentClipInfo) {
      setClipCrop(currentClipInfo.clip.id, newCrop);
    }
  };

  if (!project || project.timeline.length === 0 || !currentClipInfo) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bunker-950)',
        color: 'var(--text-muted)',
        gap: 12,
      }}>
        <Film size={40} strokeWidth={1.5} color="var(--bunker-600)" />
        <p style={{ fontSize: 14 }}>Arrastra o añade un vídeo a la línea de tiempo para comenzar</p>
      </div>
    );
  }

  // Calculate CSS zoom/offset when crop is applied and NOT currently in edit mode
  let videoStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
  };

  if (activeCrop && !isCropMode) {
    // Zoom and position video so cropped region fills the canvas
    const scaleX = 1 / activeCrop.width;
    const scaleY = 1 / activeCrop.height;
    const transX = -(activeCrop.x * 100);
    const transY = -(activeCrop.y * 100);

    videoStyle = {
      position: 'absolute',
      width: `${scaleX * 100}%`,
      height: `${scaleY * 100}%`,
      left: `${transX * scaleX}%`,
      top: `${transY * scaleY}%`,
      objectFit: 'fill',
    };
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bunker-950)',
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Aspect Ratio Box / Canvas */}
      <div
        style={{
          aspectRatio: aspectRatioCss,
          maxWidth: '100%',
          maxHeight: '100%',
          position: 'relative',
          backgroundColor: '#000000',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.8)',
          overflow: isCropMode ? 'visible' : 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <video
          ref={videoRef}
          src={getVideoAssetUrl(currentClipInfo.media.sourcePath)}
          style={videoStyle}
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => {
            if (currentTime >= totalDuration - 0.1) {
              setIsPlaying(false);
              setCurrentTime(0);
            }
          }}
        />

        {/* Visual Crop Overlay when tool is active */}
        {isCropMode && (
          <CropOverlay
            crop={activeCrop}
            onCropChange={handleCropChange}
            aspectRatioLock={cropRatioLock}
          />
        )}
      </div>
    </div>
  );
};
