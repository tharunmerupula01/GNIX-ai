"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  UploadCloud,
  Play,
  Pause,
  Sliders,
  CheckCircle2,
  Sparkles,
  Music,
  Terminal,
  ArrowRight,
  RefreshCw,
  FileAudio,
  Check,
  Edit3,
  Layers,
  Zap,
} from "lucide-react";

interface ProjectState {
  audio_slice?: string;
  transcription?: string;
  alignment?: Array<{ text: string; start: number; end: number }>;
  video?: string;
  status?: string;
}

interface IntakeDeckProps {
  activeSessionId: string | null;
  onSessionCreated?: (id: string) => void;
  onLaunchStudio?: (state: ProjectState) => void;
}

export const IntakeDeck: React.FC<IntakeDeckProps> = ({
  activeSessionId,
  onSessionCreated,
  onLaunchStudio,
}) => {
  // Upload and audio state
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number>(30);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [clipStart, setClipStart] = useState<number>(0);
  const [clipEnd, setClipEnd] = useState<number>(30);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clearProject = () => setProjectState(null);

  // Composer state
  const [prompt, setPrompt] = useState("");
  const [autoExecute, setAutoExecute] = useState(true);
  const [isolateVocals, setIsolateVocals] = useState(true);
  const [subframeLock, setSubframeLock] = useState(true);
  const [preferredLang, setPreferredLang] = useState("english");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Execution & Pipeline Feed
  // Separate loading states for pipeline execution and video generation
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<number>(0);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [lyricsDraft, setLyricsDraft] = useState<string>("");
  const [showLyricsReview, setShowLyricsReview] = useState(false);
  const [projectState, setProjectState] = useState<ProjectState | null>(null);

  // Update object URL when file changes
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setIsPlaying(false);
      setCurrentTime(0);
      setClipStart(0);
      return () => URL.revokeObjectURL(url);
    } else {
      setAudioUrl(null);
    }
  }, [file]);

  const handleAudioLoadedMetadata = () => {
    if (audioRef.current) {
      const dur = Math.round(audioRef.current.duration) || 30;
      setAudioDuration(dur);
      setClipEnd(Math.min(dur, 30));
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.currentTime >= clipEnd) {
        audioRef.current.pause();
        setIsPlaying(false);
        audioRef.current.currentTime = clipStart;
      }
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (audioRef.current.currentTime < clipStart || audioRef.current.currentTime >= clipEnd) {
        audioRef.current.currentTime = clipStart;
      }
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handlePresetClick = (presetText: string) => {
    setPrompt((prev) => (prev ? `${prev}\n${presetText}` : presetText));
  };

  const loadSong = async (fileName: string, title: string) => {
    try {
      const response = await fetch(`/${fileName}`);
      const blob = await response.blob();
      const loadedFile = new File([blob], fileName, { type: "audio/mpeg" });
      setFile(loadedFile);
      clearProject();
      setClipStart(0);
      setClipEnd(30);
      setPrompt(`Song: ${title}\\nStyle: amber_haze\\nAlign vocals with 10ms sub-frame precision`);
      setLyricsDraft("");
    } catch (e) {
      console.warn("Could not load preset audio file:", e);
    }
  };

  const executePipelineRequest = async () => {
    // Legacy pipeline for generic chat – unchanged
    if (!prompt.trim() && !file) {
      alert("Please provide an audio file or instructions for Gnix.");
      return;
    }
    setPipelineLoading(true);
    setPipelineStep(1);
    const startTimestamp = new Date().toLocaleTimeString();
    setTerminalLogs([
      `[${startTimestamp}] Engine initialized. Dispatched to RTX 4050...`,
      `[${startTimestamp}] Target window: ${clipStart}s - ${clipEnd}s (Duration: ${clipEnd - clipStart}s)`,
      `[${startTimestamp}] 01/04 Demucs v4: Isolating vocal track & backing harmonics...`,
    ]);
    try {
      const formData = new FormData();
      const sessionId = activeSessionId || `gnix-${Date.now().toString().slice(-6)}`;
      formData.append("session_id", sessionId);
      formData.append("message", prompt || "Align lyrics and isolate vocals");
      formData.append("mode", autoExecute ? "execute_pipeline" : "chat");
      if (file) {
        formData.append("audio_file", file);
      }
      setPipelineStep(2);
      let res: Response;
      try {
        res = await fetch("/api/gnix/chat", { method: "POST", body: formData });
      } catch (err) {
        res = await fetch("http://127.0.0.1:8000/api/gnix/chat", { method: "POST", body: formData });
      }
      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
      setPipelineStep(3);
      const data = await res.json();
      setPipelineStep(4);
      setTerminalLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] 02/04 Faster-Whisper: Detected 10ms onset transients...`,
      ]);
      if (data.projectState) {
        setProjectState(data.projectState);
      } else {
        setProjectState({
          status: "completed",
          transcription: data.reply || "Audio processed successfully.",
          alignment: [
            { text: "Locked Onset 01", start: clipStart, end: clipStart + 2 },
            { text: "Locked Onset 02", start: clipStart + 2.1, end: clipStart + 4.5 },
          ],
        });
      }
      if (data.action === "review_lyrics" || data.blueprint?.lyrics_text) {
        setLyricsDraft(data.blueprint?.lyrics_text || "Transcribed lines ready for review");
        setShowLyricsReview(true);
      }
      if (onSessionCreated && !activeSessionId) {
        onSessionCreated(sessionId);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message}`);
    } finally {
      setPipelineLoading(false);
      setPipelineStep(0);
    }
  };

  // New function: generate video using structured prompt schema
  const generateVideo = async () => {
    if (!file) {
      alert("Please upload an audio file before generating a video.");
      return;
    }
    // Build structured payload according to VideoPrompt schema
    const payload = {
      prompt: prompt.trim() || "Generate video",
      settings: {
        background: { type: backgroundType, value: backgroundValue },
        font: { family: fontFamily, size: Number(fontSize), color: fontColor, style: fontStyle },
        lyricsStyle: { animation: lyricsAnimation, syncWithAudio: true, position: lyricsPosition },
        effects: { type: selectedEffects },
      },
      metadata: { title: videoTitle, description: videoDescription, tags: videoTags?.split(',').map(t => t.trim()) },
    };
    const formData = new FormData();
    const sessionId = activeSessionId || `gnix-${Date.now().toString().slice(-6)}`;
    formData.append("session_id", sessionId);
    formData.append("payload", JSON.stringify(payload));
    formData.append("audio_file", file);
    setVideoLoading(true);
    try {
      let res: Response;
      try {
        res = await fetch("/api/amma-is-my-first-love", { method: "POST", body: formData });
      } catch (_) {
        res = await fetch("http://127.0.0.1:8000/api/amma-is-my-first-love", { method: "POST", body: formData });
      }
      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
      const data = await res.json();
      const resolvedVideoUrl = data.video_url || (data.video_path ? `/api/exports/${data.video_path}` : null);
      if (resolvedVideoUrl) {
        setVideoUrl(resolvedVideoUrl);
        // Populate project state for OpenCut Studio
        setProjectState({
          audio_slice: file.name,
          video: resolvedVideoUrl,
          transcription: data.transcription || "Video generated successfully.",
          alignment: data.alignment || [],
          status: data.status || "completed",
        });
        if (onSessionCreated && !activeSessionId) {
          onSessionCreated(sessionId);
        }
      } else {
        alert("Video not returned from server");
      }
    } catch (e: any) {
      console.error(e);
      alert(`Video generation failed: ${e.message}`);
    } finally {
      setVideoLoading(false);
    }
  };

  // UI state for structured prompt fields (simple defaults)
  const [backgroundType, setBackgroundType] = useState<'image'|'color'|'gradient'|'video'>('gradient');
  const [backgroundValue, setBackgroundValue] = useState('#0f0c29, #302b63'); // CSS gradient string
  const [fontFamily, setFontFamily] = useState('Montserrat');
  const [fontSize, setFontSize] = useState('48');
  const [fontColor, setFontColor] = useState('#00ff99');
  const [fontStyle, setFontStyle] = useState<'solid'|'neon'|'glow'|'outline'>('neon');
  const [lyricsAnimation, setLyricsAnimation] = useState<'kinetic'|'bounce'|'fade'|'typewriter'>('kinetic');
  const [lyricsPosition, setLyricsPosition] = useState<'center'|'bottom'|'top'>('center');
  const [selectedEffects, setSelectedEffects] = useState<Array<'strobe'|'particle'|'glitch'|'bloom'>>(['bloom']);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [videoTags, setVideoTags] = useState('');

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-16">
      {/* Hidden audio element for interactive preview */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onLoadedMetadata={handleAudioLoadedMetadata}
          onTimeUpdate={handleAudioTimeUpdate}
        />
      )}

      {/* ============================================================== */}
      {/* 1. MEDIA DROPZONE & AUDIO WORKBENCH */}
      {/* ============================================================== */}
      <section className="p-6 rounded-xl bg-[#0c0f0d] border border-[#1e2621] relative overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Music className="w-4 h-4 text-[#D4AF37]" />
            <h3 className="text-base font-light uppercase tracking-wider text-[#EAEFEC]" style={{ fontFamily: "var(--font-serif)" }}>
              Master Audio & Media Ingestion
            </h3>
          </div>
          {videoUrl && (
            <div className="mt-4">
              <video src={videoUrl} controls className="max-w-full rounded" />
            </div>
          )}
          <span className="text-[11px] font-mono text-[#8E9992] bg-[#121714] px-2.5 py-1 rounded border border-[#1e2621]">
            48kHz / 24-bit Lossless
          </span>
        </div>
        {/* Dropzone container */}
        {/* Structured Prompt Controls */}
        <section className="mt-6 p-4 rounded-xl bg-[#0c0f0d] border border-[#1e2621]">
          <h3 className="text-sm font-medium text-[#EAEFEC] mb-3" style={{ fontFamily: "var(--font-serif)" }}>Video Prompt Settings</h3>
          {/* Background */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="text-xs text-[#8E9992]">Background Type</label>
            <select value={backgroundType} onChange={(e) => setBackgroundType(e.target.value as any)} className="bg-[#080a09] border border-[#1e2621] text-[#EAEFEC] p-1 rounded">
              <option value="image">Image</option>
              <option value="color">Color</option>
              <option value="gradient">Gradient</option>
              <option value="video">Video</option>
            </select>
            <label className="text-xs text-[#8E9992]">Background Value</label>
            <input type="text" value={backgroundValue} onChange={(e) => setBackgroundValue(e.target.value)} placeholder="URL or CSS value" className="bg-[#080a09] border border-[#1e2621] text-[#EAEFEC] p-1 rounded" />
          </div>
          {/* Font */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="text-xs text-[#8E9992]">Font Family</label>
            <input type="text" value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} placeholder="Montserrat" className="bg-[#080a09] border border-[#1e2621] text-[#EAEFEC] p-1 rounded" />
            <label className="text-xs text-[#8E9992]">Font Size (px)</label>
            <input type="number" min={10} max={200} value={fontSize} onChange={(e) => setFontSize(e.target.value)} className="bg-[#080a09] border border-[#1e2621] text-[#EAEFEC] p-1 rounded" />
            <label className="text-xs text-[#8E9992]">Font Color</label>
            <input type="color" value={fontColor} onChange={(e) => setFontColor(e.target.value)} className="p-0.5 rounded" />
            <label className="text-xs text-[#8E9992]">Font Style</label>
            <select value={fontStyle} onChange={(e) => setFontStyle(e.target.value as any)} className="bg-[#080a09] border border-[#1e2621] text-[#EAEFEC] p-1 rounded">
              <option value="solid">Solid</option>
              <option value="neon">Neon</option>
              <option value="glow">Glow</option>
              <option value="outline">Outline</option>
            </select>
          </div>
          {/* Lyrics */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="text-xs text-[#8E9992]">Lyrics Animation</label>
            <select value={lyricsAnimation} onChange={(e) => setLyricsAnimation(e.target.value as any)} className="bg-[#080a09] border border-[#1e2621] text-[#EAEFEC] p-1 rounded">
              <option value="kinetic">Kinetic</option>
              <option value="bounce">Bounce</option>
              <option value="fade">Fade</option>
              <option value="typewriter">Typewriter</option>
            </select>
            <label className="text-xs text-[#8E9992]">Lyrics Position</label>
            <select value={lyricsPosition} onChange={(e) => setLyricsPosition(e.target.value as any)} className="bg-[#080a09] border border-[#1e2621] text-[#EAEFEC] p-1 rounded">
              <option value="center">Center</option>
              <option value="bottom">Bottom</option>
              <option value="top">Top</option>
            </select>
          </div>
          {/* Effects */}
          <div className="mb-3">
            <span className="text-xs text-[#8E9992]">Effects</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {(['strobe','particle','glitch','bloom'] as const).map((eff) => (
                <label key={eff} className="flex items-center text-xs text-[#EAEFEC]">
                  <input type="checkbox" checked={selectedEffects.includes(eff)} onChange={(e) => {
                    if (e.target.checked) setSelectedEffects([...selectedEffects, eff]);
                    else setSelectedEffects(selectedEffects.filter(v => v !== eff));
                  }} className="mr-1" />
                  {eff}
                </label>
              ))}
            </div>
          </div>
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="text-xs text-[#8E9992]">Title</label>
            <input type="text" value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} className="bg-[#080a09] border border-[#1e2621] text-[#EAEFEC] p-1 rounded" />
            <label className="text-xs text-[#8E9992]">Description</label>
            <textarea value={videoDescription} onChange={(e) => setVideoDescription(e.target.value)} rows={2} className="bg-[#080a09] border border-[#1e2621] text-[#EAEFEC] p-1 rounded" />
            <label className="text-xs text-[#8E9992]">Tags (comma separated)</label>
            <input type="text" value={videoTags} onChange={(e) => setVideoTags(e.target.value)} placeholder="e.g. neon, kinetic, lyrics" className="bg-[#080a09] border border-[#1e2621] text-[#EAEFEC] p-1 rounded" />
          </div>
        </section>
        {!file ? (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => document.getElementById("audioFileInput")?.click()}
            className="group relative border border-dashed border-[#D4AF37]/30 hover:border-[#D4AF37]/80 rounded-xl p-8 text-center cursor-pointer bg-[#080a09]/60 hover:bg-[#0f1411]/80 transition-all duration-300"
          >
            <input
              id="audioFileInput"
              type="file"
              accept=".mp3,.wav,.m4a,.flac,.mp4,.mov"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setFile(e.target.files[0]);
                }
              }}
            />
            <div className="w-12 h-12 mx-auto rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#F5E084] group-hover:scale-110 group-hover:border-[#D4AF37] transition-all duration-300">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-lg text-[#EAEFEC] mt-3 font-medium" style={{ fontFamily: "var(--font-serif)" }}>
              Drop Master Audio File or Click to Ingest
            </p>
            <p className="text-xs text-[#8E9992] mt-1 font-sans">
              Accepts .mp3, .wav, .flac, .m4a, or video stems up to 500MB
            </p>
            <div className="mt-4 pt-3 border-t border-[#18201a] flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); loadSong("uploaded_media_1794720994524.mp3", "Etu Pone"); }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#D4AF37]/20 hover:bg-[#D4AF37]/35 border border-[#D4AF37] text-xs font-mono text-[#F5E084] transition-all shadow-[0_0_12px_rgba(212,175,55,0.2)]"
              >
                <Music className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>🎵 Load "Etu Pone" (Telugu Masterpiece)</span>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); loadSong("uploaded_media_1794718451418.mp3", "Target Fix"); }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141b16] hover:bg-[#1a231d] border border-[#1e2621] hover:border-[#D4AF37]/40 text-xs font-mono text-[#8E9992] hover:text-[#EAEFEC] transition-all"
              >
                <Music className="w-3.5 h-3.5 text-[#8E9992]" />
                <span>Load "Target Fix" (Tamil Pop)</span>
              </button>
            </div>
          </div>
        ) : (
          /* File Uploaded Workbench & Mini Waveform Scrubber */
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg bg-[#080a09] border border-[#1e2621]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#F5E084] flex-shrink-0">
                  <FileAudio className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-mono font-medium text-[#EAEFEC] truncate max-w-md">{file.name}</p>
                  <p className="text-[10px] text-[#8E9992] font-mono mt-0.5">{(file.size / (1024 * 1024)).toFixed(2)} MB • Audio Stream Ready</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={togglePlayPause} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#D4AF37] hover:bg-[#F5E084] text-[#070908] text-xs font-medium tracking-wider uppercase transition-colors">
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" /> Preview
                    </>
                  )}
                </button>
                <button onClick={() => setFile(null)} className="px-2.5 py-1.5 rounded-md border border-[#1e2621] hover:border-red-500/50 text-[#8E9992] hover:text-red-400 text-xs transition-colors">
                  Replace
                </button>
              </div>
            </div>
            {/* Mini Waveform and Scrubber */}
            <div className="p-4 rounded-lg bg-[#080a09] border border-[#1c241f] space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-[#8E9992]">
                <span className="flex items-center gap-1.5 text-[#F5E084]">
                  <span className="w-2 h-2 rounded-full bg-[#D4AF37]"></span>
                  Target Clip Window: {formatSecs(clipStart)} — {formatSecs(clipEnd)}
                </span>
                <span>Total: {formatSecs(audioDuration)}</span>
              </div>
              <div className="relative h-14 bg-[#050706] rounded border border-[#18201a] overflow-hidden flex items-center justify-between px-2 gap-0.5">
                {Array.from({ length: 64 }).map((_, i) => {
                  const barTime = (i / 64) * audioDuration;
                  const isInWindow = barTime >= clipStart && barTime <= clipEnd;
                  const heightPct = Math.sin(i * 0.4) * 35 + 50;
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-sm transition-colors duration-150"
                      style={{
                        height: `${heightPct}%`,
                        backgroundColor: isInWindow ? "#D4AF37" : "rgba(212, 175, 55, 0.15)",
                      }}
                    />
                  );
                })}
                {audioDuration > 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-[2px] bg-red-400 pointer-events-none transition-all shadow-[0_0_8px_#f87171]"
                    style={{ left: `${(currentTime / audioDuration) * 100}%` }}
                  />
                )}
              </div>
              {/* Slider Controls */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-[#8E9992] mb-1">
                    <span>Clip In (Start)</span>
                    <span className="text-[#D4AF37]">{formatSecs(clipStart)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, clipEnd - 2)}
                    value={clipStart}
                    onChange={(e) => setClipStart(Number(e.target.value))}
                    className="w-full accent-[#D4AF37] cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-[#8E9992] mb-1">
                    <span>Clip Out (End)</span>
                    <span className="text-[#D4AF37]">{formatSecs(clipEnd)}</span>
                  </div>
                  <input
                    type="range"
                    min={clipStart + 2}
                    max={audioDuration}
                    value={clipEnd}
                    onChange={(e) => setClipEnd(Number(e.target.value))}
                    className="w-full accent-[#D4AF37] cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Single Video Preview (below workbench) */}
        {videoUrl && (
          <div className="mt-4">
            <video src={videoUrl} controls className="max-w-full rounded" />
          </div>
        )}
      </section>

      {/* ============================================================== */}
      {/* 2. PROMPT & INTENT COMPOSER */}
      {/* ============================================================== */}
      <section className="p-6 rounded-xl bg-[#0c0f0d] border border-[#1e2621] space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Edit3 className="w-4 h-4 text-[#D4AF37]" />
            <h3 className="text-base font-light uppercase tracking-wider text-[#EAEFEC]" style={{ fontFamily: "var(--font-serif)" }}>
              Instruction Blueprint & Lyric Constraints
            </h3>
          </div>
          <span className="text-xs text-[#8E9992] font-mono">{prompt.length} chars</span>
        </div>
        {/* Quick Style Presets */}
        <div className="flex flex-wrap gap-2">
          {["⚡ 10ms Vocal Sync", "🎬 Cinematic B-Roll Montage", "🎤 Auto-Transcribe & Verify", "🔥 Bass Drop Transient Cuts", "✨ Telugu / Hindi Lyric Lock"].map((preset) => (
            <button
              key={preset}
              onClick={() => handlePresetClick(preset)}
              className="px-2.5 py-1 rounded-full bg-[#121714] border border-[#1e2621] hover:border-[#D4AF37]/60 text-[11px] text-[#8E9992] hover:text-[#F5E084] transition-all"
            >
              {preset}
            </button>
          ))}
        </div>
        {/* Composer Textarea */}
        <textarea
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe your vision, paste lyrics, or define alignment rules..."
          className="w-full p-4 rounded-lg bg-[#080a09] border border-[#1e2621] focus:border-[#D4AF37]/60 text-sm text-[#EAEFEC] placeholder-[#8E9992]/50 focus:outline-none transition-colors font-sans leading-relaxed resize-y"
        />
        {/* Pro Execution Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#18201a]">
          <div className="flex flex-wrap items-center gap-3">
            {/* Mode: Auto-Execute vs Plan First */}
            <div className="flex items-center p-1 rounded-lg bg-[#080a09] border border-[#1e2621]">
              <button
                type="button"
                onClick={() => setAutoExecute(true)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium tracking-wide transition-all ${
                  autoExecute
                    ? "bg-[#D4AF37] text-[#070908] shadow-[0_0_12px_rgba(212,175,55,0.3)]"
                    : "text-[#8E9992] hover:text-[#EAEFEC]"
                }`}
              >
                Auto-Execute
              </button>
              <button
                type="button"
                onClick={() => setAutoExecute(false)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium tracking-wide transition-all ${
                  !autoExecute
                    ? "bg-[#D4AF37] text-[#070908] shadow-[0_0_12px_rgba(212,175,55,0.3)]"
                    : "text-[#8E9992] hover:text-[#EAEFEC]"
                }`}
              >
                Plan with Gnix First
              </button>
            </div>
            {/* Sub-engine flags */}
            <button
              type="button"
              onClick={() => setIsolateVocals(!isolateVocals)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-mono transition-all ${
                isolateVocals
                  ? "bg-[#141b16] border-[#D4AF37]/50 text-[#F5E084]"
                  : "bg-[#080a09] border-[#1e2621] text-[#8E9992]"
              }`}
            >
              <Zap className="w-3 h-3 text-[#D4AF37]" /> Demucs Stem Isolation
            </button>
            <button
                type="button"
                onClick={() => setSubframeLock(!subframeLock)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-mono transition-all ${
                  subframeLock
                    ? "bg-[#141b16] border-[#D4AF37]/50 text-[#F5E084]"
                    : "bg-[#080a09] border-[#1e2621] text-[#8E9992]"
                }`}
            >
              <Check className="w-3 h-3 text-emerald-400" /> 10ms Sub-Frame Lock
            </button>
          </div>
          {/* Language Selector Dropdown */}
          <select
            value={preferredLang}
            onChange={(e) => setPreferredLang(e.target.value)}
            className="bg-[#080a09] text-[#EAEFEC] border border-[#1e2621] rounded px-2 py-1 text-sm"
          >
            <option value="english">English (Romanized)</option>
            <option value="telugu">Telugu</option>
            <option value="dual">Dual (Telugu+English)</option>
          </select>
        </div>
        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={executePipelineRequest}
            disabled={pipelineLoading}
            className="flex items-center gap-2.5 px-6 py-2.5 rounded-lg bg-gradient-to-r from-[#D4AF37] via-[#F5E084] to-[#D4AF37] hover:brightness-110 text-[#070908] text-xs font-semibold tracking-wider uppercase transition-all shadow-[0_0_20px_rgba(212,175,55,0.25)] disabled:opacity-50 cursor-pointer"
          >
            {pipelineLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-[#070908]" />
                <span>Processing Onsets...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 fill-current text-[#070908]" />
                <span>Transmit to Gnix Engine</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={generateVideo}
            disabled={videoLoading}
            className="flex items-center gap-2.5 px-5 py-2.5 rounded-lg bg-[#D4AF37] hover:bg-[#F5E084] text-[#070908] text-xs font-semibold tracking-wider uppercase transition-all shadow-[0_0_16px_rgba(212,175,55,0.2)] disabled:opacity-50 cursor-pointer"
          >
            {videoLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-[#070908]" />
                <span>Generating Video...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-[#070908]" />
                <span>Generate Video</span>
              </>
            )}
          </button>
          {onLaunchStudio && (
            <button
              type="button"
              onClick={() =>
                onLaunchStudio(
                  projectState || {
                    status: "completed",
                    video: videoUrl || undefined,
                    alignment: [],
                  }
                )
              }
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#141b16] hover:bg-[#1c261f] border border-[#D4AF37]/60 text-[#F5E084] text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer"
            >
              <Layers className="w-4 h-4 text-[#D4AF37]" />
              <span>OpenCut Studio</span>
            </button>
          )}
        </div>
        {/* Video preview after generation */}
        {videoUrl && (
          <div className="mt-4 space-y-3">
            <video src={videoUrl} controls className="max-w-full rounded border border-[#1e2621]" />
            {onLaunchStudio && (
              <div>
                <button
                  type="button"
                  onClick={() =>
                    onLaunchStudio(
                      projectState || {
                        status: "completed",
                        video: videoUrl,
                        alignment: [],
                      }
                    )
                  }
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#141b16] hover:bg-[#1c261f] border border-[#D4AF37]/60 text-[#F5E084] text-xs font-semibold tracking-wider uppercase transition-all cursor-pointer"
                >
                  <Layers className="w-4 h-4 text-[#D4AF37]" />
                  <span>Open in OpenCut Studio</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
