import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import type { ProbeResult, ProjectFile } from '../types/project';

// Detect if running inside Tauri runtime
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

// Convert file path to browser-loadable streamable URL
export const getVideoAssetUrl = (filePath: string): string => {
  if (!filePath) return '';
  if (filePath.startsWith('blob:') || filePath.startsWith('http')) {
    return filePath;
  }
  if (isTauri()) {
    return convertFileSrc(filePath);
  }
  // Browser fallback for testing/dev
  return filePath;
};

// Pick video files (MP4, MOV, WebM, MKV)
export const pickVideoFiles = async (): Promise<string[]> => {
  if (isTauri()) {
    const selected = await open({
      multiple: true,
      filters: [
        {
          name: 'Video Files',
          extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'],
        },
      ],
    });
    if (!selected) return [];
    return Array.isArray(selected) ? selected : [selected];
  }

  // Web fallback with HTML file input
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'video/mp4,video/quicktime,video/webm,video/x-matroska';
    input.onchange = () => {
      if (input.files) {
        const files = Array.from(input.files).map((f) => URL.createObjectURL(f));
        resolve(files);
      } else {
        resolve([]);
      }
    };
    input.click();
  });
};

// Pick single video file for relinking
export const pickSingleVideoFile = async (): Promise<string | null> => {
  if (isTauri()) {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: 'Video Files',
          extensions: ['mp4', 'mov', 'webm', 'mkv'],
        },
      ],
    });
    return (selected as string) || null;
  }
  return null;
};

// Probe video metadata via async FFprobe in Rust backend
export const probeMedia = async (filePath: string): Promise<ProbeResult> => {
  if (isTauri()) {
    return await invoke<ProbeResult>('probe_video', { filePath });
  }

  // In-browser mock metadata loader using HTML5 Video
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = getVideoAssetUrl(filePath);
    video.onloadedmetadata = () => {
      resolve({
        duration: video.duration || 10,
        width: video.videoWidth || 1920,
        height: video.videoHeight || 1080,
        fps: 30,
        codec: 'h264',
        aspectRatio: `${video.videoWidth || 1920}:${video.videoHeight || 1080}`,
      });
    };
    video.onerror = () => {
      // If error or unknown, fallback gracefully
      resolve({
        duration: 30,
        width: 1920,
        height: 1080,
        fps: 30,
        codec: 'unknown',
        aspectRatio: '16:9',
      });
    };
  });
};

// Check if a file still exists at the given path (detect moved/deleted)
export const checkFileExists = async (filePath: string): Promise<boolean> => {
  if (isTauri()) {
    try {
      return await invoke<boolean>('check_file_exists', { filePath });
    } catch {
      return false;
    }
  }
  return true;
};

// Check FFmpeg / FFprobe availability
export const checkFfmpegStatus = async (): Promise<{ available: boolean; version?: string }> => {
  if (isTauri()) {
    try {
      return await invoke<{ available: boolean; version?: string }>('check_ffmpeg_status');
    } catch {
      return { available: false };
    }
  }
  return { available: true, version: 'Simulado (Navegador)' };
};

// Save Project Dialog
export const pickSaveProjectLocation = async (suggestedName: string): Promise<string | null> => {
  if (isTauri()) {
    const path = await save({
      defaultPath: `${suggestedName}.videoproj`,
      filters: [{ name: 'Proyecto de Video (*.videoproj)', extensions: ['videoproj', 'json'] }],
    });
    return path;
  }
  return null;
};

// Open Project Dialog
export const pickOpenProjectFile = async (): Promise<ProjectFile | null> => {
  if (isTauri()) {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Proyecto de Video (*.videoproj, *.json)', extensions: ['videoproj', 'json'] }],
    });
    if (selected && typeof selected === 'string') {
      const content = await invoke<string>('read_text_file', { filePath: selected });
      const parsed = JSON.parse(content) as ProjectFile;
      parsed.filePath = selected;
      return parsed;
    }
  }
  return null;
};

// Save Project to disk
export const writeProjectFile = async (filePath: string, project: ProjectFile): Promise<void> => {
  const jsonContent = JSON.stringify(project, null, 2);
  if (isTauri()) {
    await invoke('write_text_file', { filePath, content: jsonContent });
  } else {
    // Download as JSON in browser
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}.videoproj`;
    a.click();
    URL.revokeObjectURL(url);
  }
};

// Export Video via FFmpeg in Rust
export interface ExportPayload {
  outputPath: string;
  resolution: 'Original' | '1080p' | '720p';
  quality: 'high' | 'medium' | 'low';
  format: 'mp4' | 'mov' | 'webm' | 'mkv';
  project: ProjectFile;
}

export const startExport = async (payload: ExportPayload): Promise<void> => {
  if (isTauri()) {
    await invoke('start_export', { payload });
  } else {
    console.log('Simulating export:', payload);
  }
};

export const cancelExport = async (): Promise<void> => {
  if (isTauri()) {
    await invoke('cancel_export');
  }
};

export const pickExportSavePath = async (defaultName: string, format: string): Promise<string | null> => {
  if (isTauri()) {
    return await save({
      defaultPath: `${defaultName}.${format}`,
      filters: [{ name: `Video (*.${format})`, extensions: [format] }],
    });
  }
  return `export_${defaultName}.${format}`;
};
