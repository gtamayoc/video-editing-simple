import React, { useState, useEffect } from 'react';
import { useProjectStore, type RecentProject } from '../../store/useProjectStore';
import { pickOpenProjectFile, checkFfmpegStatus } from '../../lib/tauriApi';
import { Plus, FolderOpen, Clock, Film, AlertTriangle, CheckCircle } from 'lucide-react';
import type { ProjectSettings } from '../../types/project';

export const ProjectManager: React.FC = () => {
  const {
    createNewProject,
    loadProject,
    recentProjects,
    hasAutosaveRecovery,
    recoverAutosave,
    dismissAutosave,
  } = useProjectStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [aspectRatio, setAspectRatio] = useState<ProjectSettings['aspectRatio']>('16:9');
  const [ffmpegStatus, setFfmpegStatus] = useState<{ available: boolean; version?: string } | null>(null);

  useEffect(() => {
    checkFfmpegStatus().then(setFfmpegStatus);
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    createNewProject(projectName.trim(), aspectRatio);
  };

  const handleOpenExisting = async () => {
    try {
      const proj = await pickOpenProjectFile();
      if (proj) {
        loadProject(proj);
      }
    } catch (err) {
      console.error('Error al abrir proyecto:', err);
      alert('No se pudo abrir el proyecto. Comprueba que el archivo sea válido.');
    }
  };

  const handleOpenRecent = (recent: RecentProject) => {
    if (recent.filePath) {
      // In Tauri we could read the file again
      fetch(recent.filePath)
        .then((r) => r.json())
        .then((proj) => loadProject(proj))
        .catch(() => {
          alert('No se pudo encontrar el archivo del proyecto reciente.');
        });
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg-app)',
      color: 'var(--text-primary)',
      padding: '40px 60px',
      overflowY: 'auto',
    }}>
      {/* Recovery Banner */}
      {hasAutosaveRecovery && (
        <div style={{
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 6,
          padding: '12px 18px',
          marginBottom: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertTriangle size={20} color="var(--warning)" />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--warning)' }}>Sesión recuperable encontrada</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Se detectó un trabajo previo guardado automáticamente tras un cierre inesperado.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={recoverAutosave}>Recuperar</button>
            <button className="btn-secondary" onClick={dismissAutosave}>Descartar</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              backgroundColor: 'var(--bunker-800)',
              border: '1px solid var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Film size={20} color="var(--accent-primary)" />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px' }}>Video Editor</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 13 }}>
            Editor simple, ligero y no destructivo
          </p>
        </div>

        {/* FFmpeg status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          padding: '6px 12px',
          borderRadius: 20,
          backgroundColor: 'var(--bunker-900)',
          border: '1px solid var(--border-subtle)',
          color: ffmpegStatus?.available ? 'var(--success)' : 'var(--text-muted)',
        }}>
          {ffmpegStatus?.available ? (
            <>
              <CheckCircle size={14} />
              <span>FFmpeg Activo</span>
            </>
          ) : (
            <>
              <AlertTriangle size={14} color="var(--warning)" />
              <span style={{ color: 'var(--warning)' }}>FFmpeg no detectado en PATH</span>
            </>
          )}
        </div>
      </div>

      {/* Main Action Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 300px))', gap: 20, marginBottom: 40 }}>
        <button
          onClick={() => {
            setProjectName('Mi Video ' + new Date().toLocaleDateString());
            setIsModalOpen(true);
          }}
          style={{
            height: 120,
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 8,
            flexDirection: 'column',
            gap: 12,
            alignItems: 'flex-start',
            padding: 20,
            textAlign: 'left',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')}
        >
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 6,
            backgroundColor: 'var(--accent-primary)',
            color: '#050b14',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Plus size={22} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Nuevo Proyecto</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Crear un proyecto vacío</div>
          </div>
        </button>

        <button
          onClick={handleOpenExisting}
          style={{
            height: 120,
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 8,
            flexDirection: 'column',
            gap: 12,
            alignItems: 'flex-start',
            padding: 20,
            textAlign: 'left',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')}
        >
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 6,
            backgroundColor: 'var(--bunker-700)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <FolderOpen size={20} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Abrir Proyecto</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cargar archivo .videoproj</div>
          </div>
        </button>
      </div>

      {/* Recent Projects List */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Clock size={16} color="var(--text-muted)" />
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Proyectos Recientes
          </h2>
        </div>

        {recentProjects.length === 0 ? (
          <div style={{
            padding: '30px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px dashed var(--border-default)',
            borderRadius: 8,
            color: 'var(--text-muted)',
            textAlign: 'center',
            fontSize: 13,
          }}>
            No hay proyectos recientes aún. Crea un nuevo proyecto para comenzar.
          </div>
        ) : (
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            {recentProjects.map((p, idx) => (
              <div
                key={p.id || idx}
                onClick={() => handleOpenRecent(p)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 20px',
                  borderBottom: idx < recentProjects.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bunker-800)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {p.filePath || 'Guardado en sesión'} • {new Date(p.updatedAt).toLocaleString()}
                  </div>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Abrir →</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: 440, padding: 24 }}>
            <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 16 }}>Nuevo Proyecto</h3>
            
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Nombre del proyecto
                </label>
                <input
                  type="text"
                  autoFocus
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  style={{ width: '100%' }}
                  placeholder="Ej. Mi Video 1"
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Relación de Aspecto
                </label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as ProjectSettings['aspectRatio'])}
                  style={{ width: '100%' }}
                >
                  <option value="16:9">16:9 (Horizontal / YouTube / TV)</option>
                  <option value="9:16">9:16 (Vertical / TikTok / Reels / Shorts)</option>
                  <option value="1:1">1:1 (Cuadrado / Instagram)</option>
                  <option value="4:5">4:5 (Vertical retrato)</option>
                  <option value="Original">Original (Heredar del primer vídeo)</option>
                  <option value="Libre">Libre</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={!projectName.trim()}>
                  Crear Proyecto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
