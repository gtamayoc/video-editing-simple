import React, { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { pickVideoFiles, pickSingleVideoFile, probeMedia, checkFileExists } from '../../lib/tauriApi';
import type { MediaItem } from '../../types/project';
import { Plus, Video, Trash2, AlertCircle, Link, FileVideo } from 'lucide-react';

export const MediaBin: React.FC = () => {
  const { project, addMediaItems, relinkMediaItem, removeMediaItem, addClipToTimeline } = useProjectStore();
  const [isImporting, setIsImporting] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const importFiles = async (filePaths: string[]) => {
    if (!filePaths || filePaths.length === 0) return;
    setIsImporting(true);

    try {
      const newItems: MediaItem[] = [];
      for (const path of filePaths) {
        const fileName = path.split(/[/\\]/).pop() || 'Video';
        const exists = await checkFileExists(path);

        let probe = {
          duration: 30,
          width: 1920,
          height: 1080,
          fps: 30,
          codec: 'h264',
          aspectRatio: '16:9',
        };

        if (exists) {
          try {
            probe = await probeMedia(path);
          } catch (e) {
            console.warn('Probe warning for:', path, e);
          }
        }

        const item: MediaItem = {
          id: crypto.randomUUID(),
          sourcePath: path,
          fileName,
          duration: probe.duration || 10,
          width: probe.width || 1920,
          height: probe.height || 1080,
          fps: probe.fps || 30,
          codec: probe.codec || 'h264',
          aspectRatio: probe.aspectRatio || '16:9',
          status: exists ? 'ready' : 'missing',
        };
        newItems.push(item);
      }

      addMediaItems(newItems);

      // Auto-add first clip to timeline if timeline is empty
      if (project && project.timeline.length === 0 && newItems.length > 0) {
        addClipToTimeline(newItems[0].id);
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handlePickFiles = async () => {
    const paths = await pickVideoFiles();
    if (paths && paths.length > 0) {
      await importFiles(paths);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const paths: string[] = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        // In Tauri, webkitRelativePath or path property may exist
        const path = (file as any).path || file.name;
        paths.push(path);
      }
      await importFiles(paths);
    }
  };

  const handleRelink = async (mediaId: string) => {
    const newPath = await pickSingleVideoFile();
    if (newPath) {
      relinkMediaItem(mediaId, newPath);
    }
  };

  const mediaList = project?.media || [];

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        width: 260,
        height: '100%',
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        outline: isDraggingOver ? '2px dashed var(--accent-primary)' : 'none',
        outlineOffset: -4,
      }}
    >
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileVideo size={16} color="var(--accent-primary)" />
          <span style={{ fontWeight: 600, fontSize: 12 }}>Medios ({mediaList.length})</span>
        </div>

        <button
          onClick={handlePickFiles}
          disabled={isImporting}
          className="btn-primary"
          style={{ fontSize: 11, padding: '4px 8px' }}
          title="Importar archivos de vídeo"
        >
          <Plus size={14} />
          <span>{isImporting ? 'Cargando...' : 'Importar'}</span>
        </button>
      </div>

      {/* Media Items List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {mediaList.length === 0 ? (
          <div
            onClick={handlePickFiles}
            style={{
              height: '100%',
              minHeight: 180,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px dashed var(--border-default)',
              borderRadius: 6,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 16,
              textAlign: 'center',
              gap: 8,
            }}
          >
            <Video size={28} strokeWidth={1.5} />
            <div style={{ fontSize: 12, fontWeight: 500 }}>Haz clic o arrastra vídeos aquí</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>MP4, MOV, WebM, MKV</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {mediaList.map((item) => {
              const isMissing = item.status === 'missing';

              return (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: isMissing
                      ? '1px solid var(--danger)'
                      : '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ overflow: 'hidden', maxWidth: '85%' }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          color: isMissing ? 'var(--danger)' : 'var(--text-primary)',
                        }}
                        title={item.sourcePath}
                      >
                        {item.fileName}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        {item.width}x{item.height} • {item.duration.toFixed(1)}s • {item.codec}
                      </div>
                    </div>

                    <button
                      onClick={() => removeMediaItem(item.id)}
                      className="btn-ghost"
                      style={{ padding: 2, color: 'var(--text-muted)' }}
                      title="Eliminar de medios"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Missing media alert & Relink */}
                  {isMissing ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      padding: '4px 6px',
                      borderRadius: 4,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--danger)' }}>
                        <AlertCircle size={12} />
                        <span>Archivo no encontrado</span>
                      </div>
                      <button
                        onClick={() => handleRelink(item.id)}
                        className="btn-secondary"
                        style={{ fontSize: 10, padding: '2px 6px' }}
                      >
                        <Link size={10} />
                        <span>Re-vincular</span>
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => addClipToTimeline(item.id)}
                        className="btn-secondary"
                        style={{ fontSize: 11, padding: '3px 8px' }}
                        title="Añadir a la línea de tiempo"
                      >
                        <Plus size={12} />
                        <span>Añadir a Timeline</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
