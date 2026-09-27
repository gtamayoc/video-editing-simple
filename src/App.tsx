import React, { useEffect, useState } from 'react';
import { useProjectStore } from './store/useProjectStore';
import { ProjectManager } from './components/project-manager/ProjectManager';
import { Header } from './components/editor/Header';
import { MediaBin } from './components/editor/MediaBin';
import { VideoPreview } from './components/editor/VideoPreview';
import { PlaybackControls } from './components/editor/PlaybackControls';
import { Timeline } from './components/editor/Timeline';
import { ExportModal } from './components/editor/ExportModal';

export const App: React.FC = () => {
  const { currentScreen, init, isDirty, saveProjectLocally } = useProjectStore();
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Initialize store and autosave recovery check
  useEffect(() => {
    init();
  }, [init]);

  // Periodic autosave every 25 seconds if project has unsaved changes
  useEffect(() => {
    const timer = setInterval(() => {
      if (isDirty) {
        saveProjectLocally();
      }
    }, 25000);

    return () => clearInterval(timer);
  }, [isDirty, saveProjectLocally]);

  // Warn before closing browser/window if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        saveProjectLocally();
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, saveProjectLocally]);

  if (currentScreen === 'manager') {
    return <ProjectManager />;
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-primary)',
        overflow: 'hidden',
      }}
    >
      {/* 1. Header (Navigation, Project title, Save, Export) */}
      <Header onOpenExport={() => setIsExportModalOpen(true)} />

      {/* 2. Main Workspace: Media Bin (Left) + Video Preview (Right/Center) */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <MediaBin />
        <VideoPreview />
      </div>

      {/* 3. Playback & Editing Controls (Play, Time, Split, Crop, Zoom, Ratio) */}
      <PlaybackControls />

      {/* 4. Timeline Track (Multi-clip, Trim handles, Playhead scrubber) */}
      <Timeline />

      {/* 5. Export Modal */}
      {isExportModalOpen && (
        <ExportModal onClose={() => setIsExportModalOpen(false)} />
      )}
    </div>
  );
};

export default App;
