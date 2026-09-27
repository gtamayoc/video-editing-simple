import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import {
  pickExportSavePath,
  startExport,
  cancelExport,
  checkFileExists,
  isTauri,
} from '../../lib/tauriApi';
import { listen } from '@tauri-apps/api/event';
import type { ExportProgressEvent } from '../../types/project';
import { Download, X, AlertTriangle, CheckCircle } from 'lucide-react';

interface ExportModalProps {
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ onClose }) => {
  const { project } = useProjectStore();

  const [format, setFormat] = useState<'mp4' | 'mov' | 'webm' | 'mkv'>('mp4');
  const [resolution, setResolution] = useState<'Original' | '1080p' | '720p'>('Original');
  const [quality, setQuality] = useState<'high' | 'medium' | 'low'>('high');

  const [isExporting, setIsExporting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [progress, setProgress] = useState<ExportProgressEvent>({
    status: 'starting',
    percent: 0,
    currentTime: 0,
    totalTime: 0,
    speed: '1x',
    etaSeconds: 0,
  });

  // Check file integrity before starting
  const [missingMediaList, setMissingMediaList] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    const validateClips = async () => {
      if (!project) return;
      setIsValidating(true);
      const missing: string[] = [];

      for (const clip of project.timeline) {
        const media = project.media.find((m) => m.id === clip.mediaId);
        if (!media) {
          missing.push(`Clip ${clip.id}: Medio no encontrado`);
          continue;
        }
        const exists = await checkFileExists(media.sourcePath);
        if (!exists) {
          missing.push(media.fileName);
        }
      }

      setMissingMediaList(missing);
      setIsValidating(false);
    };

    validateClips();
  }, [project]);

  // Listen to Tauri export progress events
  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | null = null;
    listen<ExportProgressEvent>('export-progress', (event) => {
      const data = event.payload;
      setProgress(data);

      if (data.status === 'completed') {
        setIsExporting(false);
        setExportComplete(true);
      } else if (data.status === 'error') {
        setIsExporting(false);
        setErrorMessage(data.errorMessage || 'Error en el proceso de FFmpeg');
      } else if (data.status === 'cancelled') {
        setIsExporting(false);
        setIsCancelling(false);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleStartExport = async () => {
    if (!project || missingMediaList.length > 0) return;

    const defaultName = `${project.name.replace(/\s+/g, '_')}_final`;
    const savePath = await pickExportSavePath(defaultName, format);
    if (!savePath) return;

    setErrorMessage(null);
    setExportComplete(false);
    setIsExporting(true);
    setProgress({
      status: 'starting',
      percent: 0,
      currentTime: 0,
      totalTime: 100,
      speed: '0x',
      etaSeconds: 0,
    });

    try {
      await startExport({
        outputPath: savePath,
        format,
        resolution,
        quality,
        project,
      });

      // Browser simulation if not in Tauri
      if (!isTauri()) {
        let currentPct = 0;
        const interval = setInterval(() => {
          currentPct += 15;
          if (currentPct >= 100) {
            clearInterval(interval);
            setProgress({
              status: 'completed',
              percent: 100,
              currentTime: 10,
              totalTime: 10,
              speed: '2.5x',
              etaSeconds: 0,
              outputPath: savePath,
            });
            setIsExporting(false);
            setExportComplete(true);
          } else {
            setProgress({
              status: 'processing',
              percent: currentPct,
              currentTime: currentPct * 0.1,
              totalTime: 10,
              speed: '2.1x',
              etaSeconds: Math.round((100 - currentPct) / 10),
            });
          }
        }, 400);
      }
    } catch (err: any) {
      setIsExporting(false);
      setErrorMessage(err?.message || 'Error al iniciar la exportación');
    }
  };

  const handleCancelExport = async () => {
    setIsCancelling(true);
    await cancelExport();
  };

  return (
    <div className="modal-backdrop" onClick={!isExporting ? onClose : undefined}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 480, padding: 24 }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Download size={18} color="var(--accent-primary)" />
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Exportar Vídeo</h3>
          </div>
          {!isExporting && (
            <button onClick={onClose} className="btn-ghost" style={{ padding: 4 }}>
              <X size={16} />
            </button>
          )}
        </div>

        {/* Validation Errors if any */}
        {missingMediaList.length > 0 && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 6,
            padding: '12px 14px',
            marginBottom: 20,
            display: 'flex',
            gap: 10,
          }}>
            <AlertTriangle size={18} color="var(--danger)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--danger)', fontSize: 12 }}>
                No se puede exportar: archivos faltantes
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                Los siguientes vídeos fueron movidos o eliminados. Debes re-vincularlos en el panel de medios:
              </div>
              <ul style={{ fontSize: 11, color: '#fca5a5', marginTop: 4, paddingLeft: 18 }}>
                {missingMediaList.map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 6,
            padding: '10px 14px',
            marginBottom: 20,
            fontSize: 12,
            color: 'var(--danger)',
          }}>
            {errorMessage}
          </div>
        )}

        {/* Export Completed Screen */}
        {exportComplete ? (
          <div style={{
            textAlign: 'center',
            padding: '24px 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}>
            <CheckCircle size={44} color="var(--success)" />
            <h4 style={{ fontSize: 16, fontWeight: 600 }}>¡Vídeo exportado con éxito!</h4>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              El vídeo ha sido procesado mediante FFmpeg sin modificar los archivos originales.
            </p>
            <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
              <button className="btn-primary" onClick={onClose}>
                Aceptar
              </button>
            </div>
          </div>
        ) : isExporting ? (
          /* Active Export Progress */
          <div style={{ padding: '16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
              <span>Procesando con FFmpeg...</span>
              <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                {Math.round(progress.percent)}%
              </span>
            </div>

            {/* Progress bar */}
            <div style={{
              width: '100%',
              height: 8,
              backgroundColor: 'var(--bunker-800)',
              borderRadius: 4,
              overflow: 'hidden',
              marginBottom: 12,
            }}>
              <div style={{
                width: `${progress.percent}%`,
                height: '100%',
                backgroundColor: 'var(--accent-primary)',
                transition: 'width 0.2s linear',
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 24 }}>
              <span>Velocidad: {progress.speed || '1x'}</span>
              <span>{progress.etaSeconds > 0 ? `Tiempo aprox: ~${progress.etaSeconds}s` : 'Calculando...'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-danger"
                onClick={handleCancelExport}
                disabled={isCancelling}
              >
                {isCancelling ? 'Cancelando...' : 'Cancelar Exportación'}
              </button>
            </div>
          </div>
        ) : (
          /* Settings Form */
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
              {/* Formato */}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Formato de salida
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as any)}
                  style={{ width: '100%' }}
                >
                  <option value="mp4">MP4 (H.264 / Recomendado universal)</option>
                  <option value="mov">MOV (Apple QuickTime)</option>
                  <option value="webm">WebM (VP9 / Web)</option>
                  <option value="mkv">MKV (Matroska)</option>
                </select>
              </div>

              {/* Resolución */}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Resolución
                </label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as any)}
                  style={{ width: '100%' }}
                >
                  <option value="Original">Original (Resolución de los vídeos)</option>
                  <option value="1080p">1080p (Full HD)</option>
                  <option value="720p">720p (HD)</option>
                </select>
              </div>

              {/* Calidad */}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Calidad de codificación
                </label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as any)}
                  style={{ width: '100%' }}
                >
                  <option value="high">Alta (CRF 18 / Mejor nitidez)</option>
                  <option value="medium">Media (CRF 23 / Balance estándar)</option>
                  <option value="low">Rápida (CRF 28 / Menor tamaño)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cerrar
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleStartExport}
                disabled={isValidating || missingMediaList.length > 0}
              >
                Iniciar Exportación
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
