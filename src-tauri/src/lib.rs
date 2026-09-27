use std::sync::{Arc, Mutex};
use std::process::{Command, Stdio, Child};
use std::io::{BufRead, BufReader};
use std::path::Path;
use serde::{Deserialize, Serialize};
use tauri::Emitter;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Default)]
pub struct AppState {
    export_child: Arc<Mutex<Option<Child>>>,
    export_output_path: Arc<Mutex<Option<String>>>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct FfmpegStatus {
    pub available: bool,
    pub version: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ProbeResult {
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub codec: String,
    pub aspect_ratio: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CropArea {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Clip {
    pub id: String,
    pub media_id: String,
    pub trim_start: f64,
    pub trim_end: f64,
    pub crop: Option<CropArea>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MediaItem {
    pub id: String,
    pub source_path: String,
    pub file_name: String,
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub codec: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProjectSettings {
    pub aspect_ratio: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProjectFile {
    pub version: u32,
    pub id: String,
    pub name: String,
    pub settings: ProjectSettings,
    pub media: Vec<MediaItem>,
    pub timeline: Vec<Clip>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ExportPayload {
    pub output_path: String,
    pub format: String,
    pub resolution: String,
    pub quality: String,
    pub project: ProjectFile,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ExportProgressEvent {
    pub status: String, // "starting" | "processing" | "completed" | "cancelled" | "error"
    pub percent: f64,
    pub current_time: f64,
    pub total_time: f64,
    pub speed: String,
    pub eta_seconds: u64,
    pub error_message: Option<String>,
    pub output_path: Option<String>,
}

#[tauri::command]
fn check_ffmpeg_status() -> Result<FfmpegStatus, String> {
    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-version");
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    match cmd.output() {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let first_line = stdout.lines().next().unwrap_or("FFmpeg").to_string();
            Ok(FfmpegStatus {
                available: true,
                version: Some(first_line),
            })
        }
        _ => Ok(FfmpegStatus {
            available: false,
            version: None,
        }),
    }
}

#[tauri::command]
fn check_file_exists(file_path: String) -> bool {
    Path::new(&file_path).exists()
}

#[tauri::command]
fn read_text_file(file_path: String) -> Result<String, String> {
    std::fs::read_to_string(&file_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_text_file(file_path: String, content: String) -> Result<(), String> {
    std::fs::write(&file_path, content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn probe_video(file_path: String) -> Result<ProbeResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = Command::new("ffprobe");
        cmd.args([
            "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height,duration,r_frame_rate,codec_name:format=duration",
            "-of", "json",
            &file_path,
        ]);
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let output = cmd.output().map_err(|e| format!("Error al ejecutar ffprobe: {}", e))?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("ffprobe falló: {}", stderr));
        }

        let json_str = String::from_utf8_lossy(&output.stdout);
        let parsed: serde_json::Value = serde_json::from_str(&json_str)
            .map_err(|e| format!("Error parseando json de ffprobe: {}", e))?;

        let stream = parsed["streams"].as_array().and_then(|arr| arr.first());
        let width = stream.and_then(|s| s["width"].as_u64()).unwrap_or(1920) as u32;
        let height = stream.and_then(|s| s["height"].as_u64()).unwrap_or(1080) as u32;
        let codec = stream.and_then(|s| s["codec_name"].as_str()).unwrap_or("h264").to_string();

        let mut fps = 30.0;
        if let Some(r_fps) = stream.and_then(|s| s["r_frame_rate"].as_str()) {
            let parts: Vec<&str> = r_fps.split('/').collect();
            if parts.len() == 2 {
                if let (Ok(num), Ok(den)) = (parts[0].parse::<f64>(), parts[1].parse::<f64>()) {
                    if den > 0.0 {
                        fps = num / den;
                    }
                }
            }
        }

        let mut duration = stream.and_then(|s| s["duration"].as_str()).and_then(|d| d.parse::<f64>().ok())
            .unwrap_or(0.0);
        if duration <= 0.0 {
            duration = parsed["format"]["duration"].as_str().and_then(|d| d.parse::<f64>().ok()).unwrap_or(10.0);
        }

        let aspect_ratio = format!("{}:{}", width, height);

        Ok(ProbeResult {
            duration,
            width,
            height,
            fps,
            codec,
            aspect_ratio,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn cancel_export(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut child_guard = state.export_child.lock().unwrap();
    if let Some(mut child) = child_guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }

    // Clean up partial output file
    let path_guard = state.export_output_path.lock().unwrap();
    if let Some(ref path) = *path_guard {
        if Path::new(path).exists() {
            let _ = std::fs::remove_file(path);
        }
    }

    Ok(())
}

#[tauri::command]
async fn start_export(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    payload: ExportPayload,
) -> Result<(), String> {
    let output_path = payload.output_path.clone();
    let project = payload.project;
    let format = payload.format.clone();
    let resolution = payload.resolution.clone();
    let quality = payload.quality.clone();

    if project.timeline.is_empty() {
        return Err("No hay clips en la línea de tiempo".to_string());
    }

    // Calculate total duration
    let total_duration: f64 = project.timeline.iter()
        .map(|c| (c.trim_end - c.trim_start).max(0.1))
        .sum();

    // Store current output path for cleanup on cancel
    {
        let mut path_guard = state.export_output_path.lock().unwrap();
        *path_guard = Some(output_path.clone());
    }

    let child_arc = state.export_child.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = Command::new("ffmpeg");
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);

        // Add inputs
        for clip in &project.timeline {
            let media = project.media.iter().find(|m| m.id == clip.media_id);
            if let Some(m) = media {
                cmd.args(["-i", &m.source_path]);
            } else {
                let _ = app.emit("export-progress", ExportProgressEvent {
                    status: "error".to_string(),
                    percent: 0.0,
                    current_time: 0.0,
                    total_time: total_duration,
                    speed: "0x".to_string(),
                    eta_seconds: 0,
                    error_message: Some(format!("Medio no encontrado para el clip {}", clip.id)),
                    output_path: None,
                });
                return;
            }
        }

        // Build filter complex
        let mut filter_complex = String::new();
        let clip_count = project.timeline.len();

        for (i, clip) in project.timeline.iter().enumerate() {
            let media = project.media.iter().find(|m| m.id == clip.media_id).unwrap();

            let mut v_filter = format!("[{}:v]trim=start={}:end={},setpts=PTS-STARTPTS", i, clip.trim_start, clip.trim_end);

            // Visual Crop
            if let Some(ref c) = clip.crop {
                let cx = (c.x * media.width as f64).round() as u32;
                let cy = (c.y * media.height as f64).round() as u32;
                let mut cw = (c.width * media.width as f64).round() as u32;
                let mut ch = (c.height * media.height as f64).round() as u32;

                // Ensure dimensions are even (H.264 requirement)
                cw = (cw / 2) * 2;
                ch = (ch / 2) * 2;

                v_filter.push_str(&format!(",crop={}:{}:{}:{}", cw.max(2), ch.max(2), cx, cy));
            }

            // Resolution scale
            if resolution == "1080p" {
                v_filter.push_str(",scale=-2:1080");
            } else if resolution == "720p" {
                v_filter.push_str(",scale=-2:720");
            }

            v_filter.push_str(&format!("[v{}];", i));
            filter_complex.push_str(&v_filter);

            let a_filter = format!("[{}:a]atrim=start={}:end={},asetpts=PTS-STARTPTS[a{}];", i, clip.trim_start, clip.trim_end, i);
            filter_complex.push_str(&a_filter);
        }

        // Concat
        if clip_count == 1 {
            filter_complex.push_str("[v0]copy[outv];[a0]copy[outa]");
        } else {
            let mut concat_inputs = String::new();
            for i in 0..clip_count {
                concat_inputs.push_str(&format!("[v{}][a{}]", i, i));
            }
            filter_complex.push_str(&format!("{}concat=n={}:v=1:a=1[outv][outa]", concat_inputs, clip_count));
        }

        cmd.args(["-filter_complex", &filter_complex]);
        cmd.args(["-map", "[outv]", "-map", "[outa]"]);

        // Codec and Quality options
        let crf = match quality.as_str() {
            "high" => "18",
            "medium" => "23",
            _ => "28",
        };

        if format == "webm" {
            cmd.args(["-c:v", "libvpx-vp9", "-crf", crf, "-b:v", "0", "-c:a", "libopus"]);
        } else {
            cmd.args(["-c:v", "libx264", "-preset", "fast", "-crf", crf, "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k"]);
        }

        cmd.args(["-progress", "pipe:1", "-y", &output_path]);
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                let _ = app.emit("export-progress", ExportProgressEvent {
                    status: "error".to_string(),
                    percent: 0.0,
                    current_time: 0.0,
                    total_time: total_duration,
                    speed: "0x".to_string(),
                    eta_seconds: 0,
                    error_message: Some(format!("No se pudo iniciar FFmpeg: {}", e)),
                    output_path: None,
                });
                return;
            }
        };

        let stdout = child.stdout.take();
        {
            let mut guard = child_arc.lock().unwrap();
            *guard = Some(child);
        }

        // Read progress from stdout
        if let Some(out) = stdout {
            let reader = BufReader::new(out);
            for line in reader.lines().flatten() {
                if line.starts_with("out_time_ms=") {
                    let ms_str = &line["out_time_ms=".len()..];
                    if let Ok(ms) = ms_str.parse::<f64>() {
                        let current_sec = ms / 1_000_000.0;
                        let pct = (current_sec / total_duration * 100.0).min(99.0);
                        let remaining_sec = (total_duration - current_sec).max(0.0);

                        let _ = app.emit("export-progress", ExportProgressEvent {
                            status: "processing".to_string(),
                            percent: pct,
                            current_time: current_sec,
                            total_time: total_duration,
                            speed: "1.5x".to_string(),
                            eta_seconds: remaining_sec.round() as u64,
                            error_message: None,
                            output_path: None,
                        });
                    }
                }
            }
        }

        // Wait for child process to finish
        let status = {
            let mut guard = child_arc.lock().unwrap();
            if let Some(mut child) = guard.take() {
                child.wait().ok()
            } else {
                None
            }
        };

        if let Some(s) = status {
            if s.success() {
                let _ = app.emit("export-progress", ExportProgressEvent {
                    status: "completed".to_string(),
                    percent: 100.0,
                    current_time: total_duration,
                    total_time: total_duration,
                    speed: "1x".to_string(),
                    eta_seconds: 0,
                    error_message: None,
                    output_path: Some(output_path),
                });
            } else {
                let _ = app.emit("export-progress", ExportProgressEvent {
                    status: "error".to_string(),
                    percent: 0.0,
                    current_time: 0.0,
                    total_time: total_duration,
                    speed: "0x".to_string(),
                    eta_seconds: 0,
                    error_message: Some("El proceso FFmpeg terminó con un código de error".to_string()),
                    output_path: None,
                });
            }
        }
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState::default())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_ffmpeg_status,
            check_file_exists,
            read_text_file,
            write_text_file,
            probe_video,
            start_export,
            cancel_export
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
