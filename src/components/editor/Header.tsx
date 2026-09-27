import React, { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { pickSaveProjectLocation, writeProjectFile } from '../../lib/tauriApi';
import { ArrowLeft, Save, Download, Film, Check } from 'lucide-react';

interface HeaderProps {
  onOpenExport: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenExport }) => {
  const { project, setScreen, isDirty, loadProject } = useProjectStore();
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const handleBack = () => {
    if (isDirty) {
      const confirmLeave = window.confirm(
        'Tienes cambios sin guardar en el proyecto. ¿Deseas salir al menú principal?'
      );
      if (!confirmLeave) return;
    }
    setScreen('manager');
  };

  const handleSave = async () => {
    if (!project) return;
    setIsSaving(true);
    try {
      let targetPath = project.filePath;
      if (!targetPath) {
        const picked = await pickSaveProjectLocation(project.name);
        if (!picked) {
          setIsSaving(false);
          return;
        }
        targetPath = picked;
      }

      const updated = { ...project, filePath: targetPath, updatedAt: Date.now() };
      await writeProjectFile(targetPath, updated);
      loadProject(updated);

      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } catch (err) {
      console.error('Error al guardar proyecto:', err);
      alert('Error al guardar proyecto.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <header
      style={{
        height: 48,
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 50,
      }}
    >
      {/* Left: Back & Project Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={handleBack} className="btn-ghost" title="Volver al menú principal">
          <ArrowLeft size={16} />
          <span>Proyectos</span>
        </button>

        <div style={{ width: 1, height: 20, backgroundColor: 'var(--border-subtle)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Film size={16} color="var(--accent-primary)" />
          <span style={{ fontWeight: 600, fontSize: 13 }}>{project?.name || 'Proyecto'}</span>
          {isDirty && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: 'var(--warning)',
                display: 'inline-block',
              }}
              title="Cambios sin guardar"
            />
          )}
        </div>
      </div>

      {/* Right: Save & Export */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn-secondary"
          style={{ fontSize: 11, padding: '5px 12px' }}
          title="Guardar proyecto (Ctrl+S)"
        >
          {justSaved ? (
            <>
              <Check size={14} color="var(--success)" />
              <span style={{ color: 'var(--success)' }}>Guardado</span>
            </>
          ) : (
            <>
              <Save size={14} />
              <span>{isSaving ? 'Guardando...' : 'Guardar'}</span>
            </>
          )}
        </button>

        <button
          onClick={onOpenExport}
          className="btn-primary"
          style={{ fontSize: 11, padding: '5px 14px' }}
          title="Exportar vídeo final con FFmpeg"
          disabled={!project || project.timeline.length === 0}
        >
          <Download size={14} />
          <span>Exportar</span>
        </button>
      </div>
    </header>
  );
};
