import { create } from 'zustand';
import type { ProjectFile, ProjectSettings, MediaItem, Clip, CropArea } from '../types/project';

const AUTOSAVE_KEY = 'video_editor_autosave_v1';
const RECENT_KEY = 'video_editor_recent_projects_v1';

export interface RecentProject {
  id: string;
  name: string;
  filePath?: string;
  updatedAt: number;
}

interface ProjectState {
  currentScreen: 'manager' | 'editor';
  project: ProjectFile | null;
  activeClipId: string | null;
  currentTime: number; // Global timeline playhead (seconds)
  isPlaying: boolean;
  isCropMode: boolean;
  timelineZoom: number; // Pixels per second
  isDirty: boolean;
  recentProjects: RecentProject[];
  hasAutosaveRecovery: boolean;

  // Actions
  init: () => void;
  setScreen: (screen: 'manager' | 'editor') => void;
  createNewProject: (name: string, aspectRatio?: ProjectSettings['aspectRatio']) => void;
  loadProject: (project: ProjectFile) => void;
  recoverAutosave: () => void;
  dismissAutosave: () => void;
  saveProjectLocally: () => void;
  setAspectRatio: (aspectRatio: ProjectSettings['aspectRatio']) => void;
  
  // Media actions
  addMediaItems: (items: MediaItem[]) => void;
  relinkMediaItem: (mediaId: string, newPath: string) => void;
  removeMediaItem: (mediaId: string) => void;

  // Timeline / Clip actions
  addClipToTimeline: (mediaId: string) => void;
  updateClip: (clipId: string, updates: Partial<Clip>) => void;
  splitClipAtPlayhead: () => void;
  removeClip: (clipId: string) => void;
  moveClip: (clipId: string, newIndex: number) => void;
  setActiveClipId: (clipId: string | null) => void;
  setClipCrop: (clipId: string, crop: CropArea | null) => void;

  // Playback & UI actions
  setCurrentTime: (time: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  togglePlay: () => void;
  setIsCropMode: (isCrop: boolean) => void;
  setTimelineZoom: (zoom: number) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentScreen: 'manager',
  project: null,
  activeClipId: null,
  currentTime: 0,
  isPlaying: false,
  isCropMode: false,
  timelineZoom: 60, // 60px = 1 second
  isDirty: false,
  recentProjects: [],
  hasAutosaveRecovery: false,

  init: () => {
    try {
      const recentRaw = localStorage.getItem(RECENT_KEY);
      const recents: RecentProject[] = recentRaw ? JSON.parse(recentRaw) : [];
      const autosaved = localStorage.getItem(AUTOSAVE_KEY);
      set({
        recentProjects: recents,
        hasAutosaveRecovery: !!autosaved,
      });
    } catch {
      // fallback
    }
  },

  setScreen: (screen) => set({ currentScreen: screen }),

  createNewProject: (name, aspectRatio = '16:9') => {
    const newProj: ProjectFile = {
      version: 1,
      id: crypto.randomUUID(),
      name: name.trim() || 'Nuevo Proyecto',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      settings: {
        aspectRatio,
        exportPreset: {
          format: 'mp4',
          resolution: 'Original',
          quality: 'high',
        },
      },
      media: [],
      timeline: [],
    };

    set({
      project: newProj,
      activeClipId: null,
      currentTime: 0,
      isPlaying: false,
      isCropMode: false,
      currentScreen: 'editor',
      isDirty: true,
    });

    get().saveProjectLocally();
  },

  loadProject: (loadedProject: ProjectFile) => {
    // Add to recents
    const existingRecents = get().recentProjects.filter((p) => p.id !== loadedProject.id);
    const updatedRecents: RecentProject[] = [
      {
        id: loadedProject.id,
        name: loadedProject.name,
        filePath: loadedProject.filePath,
        updatedAt: Date.now(),
      },
      ...existingRecents,
    ].slice(0, 10);

    localStorage.setItem(RECENT_KEY, JSON.stringify(updatedRecents));

    set({
      project: loadedProject,
      activeClipId: loadedProject.timeline[0]?.id || null,
      currentTime: 0,
      isPlaying: false,
      isCropMode: false,
      currentScreen: 'editor',
      recentProjects: updatedRecents,
      isDirty: false,
    });
  },

  recoverAutosave: () => {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (raw) {
        const recovered: ProjectFile = JSON.parse(raw);
        get().loadProject(recovered);
        set({ isDirty: true, hasAutosaveRecovery: false });
      }
    } catch (e) {
      console.error('Error recovering autosave:', e);
      set({ hasAutosaveRecovery: false });
    }
  },

  dismissAutosave: () => {
    localStorage.removeItem(AUTOSAVE_KEY);
    set({ hasAutosaveRecovery: false });
  },

  saveProjectLocally: () => {
    const proj = get().project;
    if (!proj) return;
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(proj));
    } catch (err) {
      console.warn('Autosave warning:', err);
    }
  },

  setAspectRatio: (aspectRatio) => {
    const { project } = get();
    if (!project) return;
    const updated: ProjectFile = {
      ...project,
      settings: { ...project.settings, aspectRatio },
      updatedAt: Date.now(),
    };
    set({ project: updated, isDirty: true });
    get().saveProjectLocally();
  },

  addMediaItems: (newItems) => {
    const { project } = get();
    if (!project) return;
    const updatedMedia = [...project.media, ...newItems];
    const updated: ProjectFile = {
      ...project,
      media: updatedMedia,
      updatedAt: Date.now(),
    };
    set({ project: updated, isDirty: true });
    get().saveProjectLocally();
  },

  relinkMediaItem: (mediaId, newPath) => {
    const { project } = get();
    if (!project) return;
    const fileName = newPath.split(/[/\\]/).pop() || 'video';
    const updatedMedia = project.media.map((item) =>
      item.id === mediaId ? { ...item, sourcePath: newPath, fileName, status: 'ready' as const } : item
    );
    const updated: ProjectFile = {
      ...project,
      media: updatedMedia,
      updatedAt: Date.now(),
    };
    set({ project: updated, isDirty: true });
    get().saveProjectLocally();
  },

  removeMediaItem: (mediaId) => {
    const { project } = get();
    if (!project) return;
    const updatedMedia = project.media.filter((item) => item.id !== mediaId);
    const updatedTimeline = project.timeline.filter((clip) => clip.mediaId !== mediaId);
    const updated: ProjectFile = {
      ...project,
      media: updatedMedia,
      timeline: updatedTimeline,
      updatedAt: Date.now(),
    };
    set({ project: updated, isDirty: true });
    get().saveProjectLocally();
  },

  addClipToTimeline: (mediaId) => {
    const { project } = get();
    if (!project) return;
    const media = project.media.find((m) => m.id === mediaId);
    if (!media) return;

    const newClip: Clip = {
      id: crypto.randomUUID(),
      mediaId,
      trimStart: 0,
      trimEnd: media.duration,
      crop: null,
    };

    const updatedTimeline = [...project.timeline, newClip];
    const updated: ProjectFile = {
      ...project,
      timeline: updatedTimeline,
      updatedAt: Date.now(),
    };

    set({
      project: updated,
      activeClipId: newClip.id,
      isDirty: true,
    });
    get().saveProjectLocally();
  },

  updateClip: (clipId, updates) => {
    const { project } = get();
    if (!project) return;
    const updatedTimeline = project.timeline.map((clip) =>
      clip.id === clipId ? { ...clip, ...updates } : clip
    );
    const updated: ProjectFile = {
      ...project,
      timeline: updatedTimeline,
      updatedAt: Date.now(),
    };
    set({ project: updated, isDirty: true });
    get().saveProjectLocally();
  },

  splitClipAtPlayhead: () => {
    const { project, currentTime } = get();
    if (!project || project.timeline.length === 0) return;

    // Find which clip is at currentTime
    let accumulated = 0;
    for (let i = 0; i < project.timeline.length; i++) {
      const clip = project.timeline[i];
      const clipDuration = clip.trimEnd - clip.trimStart;
      const clipEnd = accumulated + clipDuration;

      if (currentTime > accumulated && currentTime < clipEnd) {
        // Can split here
        const offsetInClip = currentTime - accumulated;
        const splitPoint = clip.trimStart + offsetInClip;

        // Clip 1: start to splitPoint
        const clip1: Clip = {
          ...clip,
          trimEnd: splitPoint,
        };

        // Clip 2: splitPoint to end
        const clip2: Clip = {
          ...clip,
          id: crypto.randomUUID(),
          trimStart: splitPoint,
        };

        const updatedTimeline = [
          ...project.timeline.slice(0, i),
          clip1,
          clip2,
          ...project.timeline.slice(i + 1),
        ];

        const updated: ProjectFile = {
          ...project,
          timeline: updatedTimeline,
          updatedAt: Date.now(),
        };

        set({
          project: updated,
          activeClipId: clip2.id,
          isDirty: true,
        });
        get().saveProjectLocally();
        return;
      }
      accumulated = clipEnd;
    }
  },

  removeClip: (clipId) => {
    const { project, activeClipId } = get();
    if (!project) return;
    const updatedTimeline = project.timeline.filter((clip) => clip.id !== clipId);
    const updated: ProjectFile = {
      ...project,
      timeline: updatedTimeline,
      updatedAt: Date.now(),
    };
    set({
      project: updated,
      activeClipId: activeClipId === clipId ? (updatedTimeline[0]?.id || null) : activeClipId,
      isDirty: true,
    });
    get().saveProjectLocally();
  },

  moveClip: (clipId, newIndex) => {
    const { project } = get();
    if (!project) return;
    const currentIndex = project.timeline.findIndex((c) => c.id === clipId);
    if (currentIndex === -1 || newIndex < 0 || newIndex >= project.timeline.length) return;

    const timelineCopy = [...project.timeline];
    const [moved] = timelineCopy.splice(currentIndex, 1);
    timelineCopy.splice(newIndex, 0, moved);

    const updated: ProjectFile = {
      ...project,
      timeline: timelineCopy,
      updatedAt: Date.now(),
    };
    set({ project: updated, isDirty: true });
    get().saveProjectLocally();
  },

  setActiveClipId: (clipId) => set({ activeClipId: clipId }),

  setClipCrop: (clipId, crop) => {
    get().updateClip(clipId, { crop });
  },

  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setIsCropMode: (isCropMode) => set({ isCropMode }),
  setTimelineZoom: (timelineZoom) => set({ timelineZoom: Math.max(10, Math.min(200, timelineZoom)) }),
}));
