import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../store/useProjectStore';
import type { MediaItem } from '../types/project';

// Mock localStorage in Node environment
const storage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => { storage[key] = value; },
  removeItem: (key: string) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
  key: (i: number) => Object.keys(storage)[i] ?? null,
  length: 0,
};
Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true });

describe('Editor de Vídeo: Edición No Destructiva y Resiliencia', () => {
  beforeEach(() => {
    // Reset localStorage
    localStorage.clear();
    useProjectStore.setState({
      currentScreen: 'manager',
      project: null,
      activeClipId: null,
      currentTime: 0,
      isPlaying: false,
      isCropMode: false,
      timelineZoom: 60,
      isDirty: false,
      recentProjects: [],
      hasAutosaveRecovery: false,
    });
  });

  it('1. Crea un proyecto con versionado y valores seguros', () => {
    const store = useProjectStore.getState();
    store.createNewProject('Proyecto Test', '9:16');

    const state = useProjectStore.getState();
    expect(state.project).not.toBeNull();
    expect(state.project?.version).toBe(1);
    expect(state.project?.name).toBe('Proyecto Test');
    expect(state.project?.settings.aspectRatio).toBe('9:16');
    expect(state.project?.media).toEqual([]);
    expect(state.project?.timeline).toEqual([]);
    expect(state.currentScreen).toBe('editor');
  });

  it('2. Añade medios y genera clips en timeline sin modificar fuentes', () => {
    const store = useProjectStore.getState();
    store.createNewProject('Test Media', '16:9');

    const sampleMedia: MediaItem = {
      id: 'media-1',
      sourcePath: 'C:\\videos\\sample.mp4',
      fileName: 'sample.mp4',
      duration: 60,
      width: 1920,
      height: 1080,
      fps: 30,
      codec: 'h264',
      aspectRatio: '16:9',
      status: 'ready',
    };

    store.addMediaItems([sampleMedia]);
    store.addClipToTimeline('media-1');

    const state = useProjectStore.getState();
    expect(state.project?.media.length).toBe(1);
    expect(state.project?.timeline.length).toBe(1);

    const clip = state.project?.timeline[0];
    expect(clip?.mediaId).toBe('media-1');
    expect(clip?.trimStart).toBe(0);
    expect(clip?.trimEnd).toBe(60);
    expect(clip?.crop).toBeNull();
    // La fuente original conserva su duración
    expect(state.project?.media[0].duration).toBe(60);
  });

  it('3. Recorte no destructivo (Trim In / Trim Out)', () => {
    const store = useProjectStore.getState();
    store.createNewProject('Test Trim', '16:9');

    const sampleMedia: MediaItem = {
      id: 'media-1',
      sourcePath: 'C:\\videos\\sample.mp4',
      fileName: 'sample.mp4',
      duration: 100,
      width: 1920,
      height: 1080,
      fps: 30,
      codec: 'h264',
      aspectRatio: '16:9',
      status: 'ready',
    };

    store.addMediaItems([sampleMedia]);
    store.addClipToTimeline('media-1');

    const clipId = useProjectStore.getState().project!.timeline[0].id;

    // Recortar inicio al segundo 10 y fin al segundo 45
    store.updateClip(clipId, { trimStart: 10, trimEnd: 45 });

    const state = useProjectStore.getState();
    const updatedClip = state.project!.timeline[0];

    expect(updatedClip.trimStart).toBe(10);
    expect(updatedClip.trimEnd).toBe(45);
    // El archivo de medio permanece 100% intacto con su duración original
    expect(state.project!.media[0].duration).toBe(100);
  });

  it('4. División de Clip (Split) en la posición del playhead', () => {
    const store = useProjectStore.getState();
    store.createNewProject('Test Split', '16:9');

    const sampleMedia: MediaItem = {
      id: 'media-1',
      sourcePath: 'C:\\videos\\sample.mp4',
      fileName: 'sample.mp4',
      duration: 60,
      width: 1920,
      height: 1080,
      fps: 30,
      codec: 'h264',
      aspectRatio: '16:9',
      status: 'ready',
    };

    store.addMediaItems([sampleMedia]);
    store.addClipToTimeline('media-1');

    // Colocar el playhead en el segundo 20
    store.setCurrentTime(20);
    store.splitClipAtPlayhead();

    const state = useProjectStore.getState();
    expect(state.project?.timeline.length).toBe(2);

    const [firstPart, secondPart] = state.project!.timeline;
    expect(firstPart.trimStart).toBe(0);
    expect(firstPart.trimEnd).toBe(20);

    expect(secondPart.trimStart).toBe(20);
    expect(secondPart.trimEnd).toBe(60);

    // Ambos apuntan al mismo archivo original sin duplicar datos ni alterar el archivo
    expect(firstPart.mediaId).toBe('media-1');
    expect(secondPart.mediaId).toBe('media-1');
  });

  it('5. Crop visual con coordenadas normalizadas y cálculo par para FFmpeg', () => {
    const store = useProjectStore.getState();
    store.createNewProject('Test Crop', '9:16');

    const sampleMedia: MediaItem = {
      id: 'media-1',
      sourcePath: 'C:\\videos\\sample.mp4',
      fileName: 'sample.mp4',
      duration: 30,
      width: 1920,
      height: 1080,
      fps: 30,
      codec: 'h264',
      aspectRatio: '16:9',
      status: 'ready',
    };

    store.addMediaItems([sampleMedia]);
    store.addClipToTimeline('media-1');

    const clipId = useProjectStore.getState().project!.timeline[0].id;

    // Aplicar crop centrado
    store.setClipCrop(clipId, {
      x: 0.25,
      y: 0.1,
      width: 0.5,
      height: 0.8,
    });

    const clip = useProjectStore.getState().project!.timeline[0];
    expect(clip.crop).not.toBeNull();
    expect(clip.crop?.x).toBe(0.25);
    expect(clip.crop?.width).toBe(0.5);

    // Simulación del cálculo en Rust para verificar que las dimensiones siempre sean pares
    const rawWidth = Math.round(clip.crop!.width * sampleMedia.width);
    const rawHeight = Math.round(clip.crop!.height * sampleMedia.height);
    const evenWidth = Math.floor(rawWidth / 2) * 2;
    const evenHeight = Math.floor(rawHeight / 2) * 2;

    expect(evenWidth % 2).toBe(0);
    expect(evenHeight % 2).toBe(0);
    expect(evenWidth).toBe(960);
    expect(evenHeight).toBe(864);
  });

  it('6. Detección de archivo movido/eliminado y Re-vinculación (Relink)', () => {
    const store = useProjectStore.getState();
    store.createNewProject('Test Relink', '16:9');

    const sampleMedia: MediaItem = {
      id: 'media-1',
      sourcePath: 'C:\\old_path\\video.mp4',
      fileName: 'video.mp4',
      duration: 40,
      width: 1920,
      height: 1080,
      fps: 30,
      codec: 'h264',
      aspectRatio: '16:9',
      status: 'missing', // Simula que el archivo fue movido
    };

    store.addMediaItems([sampleMedia]);
    store.addClipToTimeline('media-1');
    const clipId = useProjectStore.getState().project!.timeline[0].id;
    store.updateClip(clipId, { trimStart: 5, trimEnd: 25 });

    // Usuario re-vincula el archivo a una nueva ruta
    store.relinkMediaItem('media-1', 'D:\\new_location\\video_renamed.mp4');

    const state = useProjectStore.getState();
    const updatedMedia = state.project!.media[0];
    expect(updatedMedia.sourcePath).toBe('D:\\new_location\\video_renamed.mp4');
    expect(updatedMedia.fileName).toBe('video_renamed.mp4');
    expect(updatedMedia.status).toBe('ready');

    // ¡Los recortes y la edición del clip en la timeline se preservaron intactos!
    const clip = state.project!.timeline[0];
    expect(clip.trimStart).toBe(5);
    expect(clip.trimEnd).toBe(25);
  });

  it('7. Autoguardado y Recuperación de Sesión tras Cierre Inesperado', () => {
    const store = useProjectStore.getState();
    store.createNewProject('Proyecto Inesperado', '1:1');

    const sampleMedia: MediaItem = {
      id: 'media-1',
      sourcePath: 'C:\\media\\test.mp4',
      fileName: 'test.mp4',
      duration: 50,
      width: 1080,
      height: 1080,
      fps: 30,
      codec: 'h264',
      aspectRatio: '1:1',
      status: 'ready',
    };

    store.addMediaItems([sampleMedia]);
    store.addClipToTimeline('media-1');
    store.saveProjectLocally();

    // Simular que el navegador/app se cerró y se volvió a abrir
    const savedJson = localStorage.getItem('video_editor_autosave_v1');
    expect(savedJson).not.toBeNull();

    // Reiniciar estado
    useProjectStore.setState({
      currentScreen: 'manager',
      project: null,
      hasAutosaveRecovery: true,
    });

    // Recuperar
    useProjectStore.getState().recoverAutosave();

    const recovered = useProjectStore.getState().project;
    expect(recovered).not.toBeNull();
    expect(recovered?.name).toBe('Proyecto Inesperado');
    expect(recovered?.settings.aspectRatio).toBe('1:1');
    expect(recovered?.timeline.length).toBe(1);
    expect(useProjectStore.getState().currentScreen).toBe('editor');
  });
});
