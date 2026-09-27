export interface ProjectSettings {
  aspectRatio: 'Original' | '16:9' | '9:16' | '1:1' | '4:5' | 'Libre';
  exportPreset: {
    format: 'mp4' | 'mov' | 'webm' | 'mkv';
    resolution: 'Original' | '1080p' | '720p';
    quality: 'high' | 'medium' | 'low';
  };
}

export interface MediaItem {
  id: string;
  sourcePath: string;
  fileName: string;
  duration: number; // in seconds
  width: number;
  height: number;
  fps: number;
  codec: string;
  aspectRatio: string;
  thumbnailUrl?: string;
  status: 'ready' | 'missing' | 'error';
}

export interface CropArea {
  // Coordinates normalized from 0.0 to 1.0 relative to original video resolution
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Clip {
  id: string;
  mediaId: string;
  trimStart: number; // in seconds
  trimEnd: number;   // in seconds
  crop: CropArea | null; // null means no crop (full frame)
}

export interface ProjectFile {
  version: 1;
  id: string;
  name: string;
  filePath?: string;
  createdAt: number;
  updatedAt: number;
  settings: ProjectSettings;
  media: MediaItem[];
  timeline: Clip[];
}

export interface ExportProgressEvent {
  status: 'starting' | 'processing' | 'completed' | 'cancelled' | 'error';
  percent: number; // 0 to 100
  currentTime: number; // in seconds
  totalTime: number; // in seconds
  speed: string;
  etaSeconds: number;
  errorMessage?: string;
  outputPath?: string;
}

export interface ProbeResult {
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  aspectRatio: string;
}
