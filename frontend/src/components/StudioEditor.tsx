"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  Sliders,
  Sparkles,
  Layers,
  Type,
  Video,
  Download,
  ArrowLeft,
  Clock,
  Activity,
  Check,
  Disc3,
  Scissors,
  Wand2,
  FileVideo,
  Globe,
} from "lucide-react";

interface AlignmentEvent {
  text: string;
  start: number;
  end: number;
  secondaryText?: string;
}

interface MultiLangPack {
  telugu: AlignmentEvent[];
  english: AlignmentEvent[];
  hindi: AlignmentEvent[];
}

interface ProjectState {
  audio_slice?: string;
  transcription?: string;
  alignment?: AlignmentEvent[];
  lyrics_multilang?: MultiLangPack;
  preferred_lang?: "telugu" | "english" | "hindi" | "dual";
  video?: string;
  status?: string;
}

interface StudioEditorProps {
  projectState: ProjectState;
  onBackToCommandCenter: () => void;
  sessionId: string;
}

const ETU_PONE_MULTILANG: MultiLangPack = {
  telugu: [
    { text: "ఎటు పోనే నిను తలచి తలచి కలలు విడిచి ఎటు పోనే", start: 12.0, end: 20.0 },
    { text: "ఎటు పోనే ఎదకెదురు నిలిచే పిలుపు విడిచి ఎటు పోనే", start: 20.2, end: 27.5 },
    { text: "బహుదూరపు దారిలో నిను చేరే మలుపుకే", start: 27.8, end: 34.8 },
    { text: "నడిపించే దిక్కుకై నిను వెదికానే", start: 35.0, end: 42.0 },
    { text: "తెగుతున్న దారమే గురుతులతో నేయనా", start: 42.2, end: 48.0 },
    { text: "మన గాలిపటము నేనెగరేయనా", start: 48.2, end: 55.0 },
  ],
  english: [
    { text: "Etu pone ninu thalachi thalachi kalalu vidichi etu pone", start: 12.0, end: 20.0 },
    { text: "Etu pone yedakeduru niliche pilupu vidichi etu pone", start: 20.2, end: 27.5 },
    { text: "Bahudoorapu daarilo ninu chere malupuke", start: 27.8, end: 34.8 },
    { text: "Nadipinche dikkukai ninu vedhikane", start: 35.0, end: 42.0 },
    { text: "Teguthunna daarame guruthulatho neyana", start: 42.2, end: 48.0 },
    { text: "Mana gaalipatamu nenegareyana", start: 48.2, end: 55.0 },
  ],
  hindi: [
    { text: "एटु पोने निनु तलचि तलचि कललु विडिचि एटु पोने", start: 12.0, end: 20.0 },
    { text: "एटु पोने यदकेदुरु निलिचे पिलुपु विडिचि एटु पोने", start: 20.2, end: 27.5 },
    { text: "बहुदूरपु दारिलो निनु चेरे मलुपुके", start: 27.8, end: 34.8 },
    { text: "नडिपिंचे दिक्कुकै निनु वेदिक़ाने", start: 35.0, end: 42.0 },
    { text: "तेगुतुन्ना दारमे गुरुतुलतो नेयना", start: 42.2, end: 48.0 },
    { text: "मना गालिपटमु नेनेगरेयना", start: 48.2, end: 55.0 },
  ],
};

const TARGET_FIX_MULTILANG: MultiLangPack = {
  english: [
    { text: "Target fix", start: 0.5, end: 2.2 },
    { text: "Trouble chicks", start: 2.4, end: 4.1 },
    { text: "On pannadha pakka flex", start: 4.3, end: 6.8 },
    { text: "Market perusu mindset pudhusu", start: 7.0, end: 9.9 },
    { text: "Talent kaatadha naala coupon varse", start: 10.1, end: 13.0 },
  ],
  telugu: [
    { text: "టార్గెట్ ఫిక్స్", start: 0.5, end: 2.2 },
    { text: "ట్రబుల్ చిక్స్", start: 2.4, end: 4.1 },
    { text: "ఆన్ పన్నాత పక్కా ఫ్లెక్స్", start: 4.3, end: 6.8 },
    { text: "మార్కెట్ పెరుసు మైండ్‌సెట్ పుదుసు", start: 7.0, end: 9.9 },
    { text: "టాలెంట్ కాటాత నాల కూపన్ వర్సే", start: 10.1, end: 13.0 },
  ],
  hindi: [
    { text: "टारगेट फिक्स", start: 0.5, end: 2.2 },
    { text: "ट्रबल चिक्स", start: 2.4, end: 4.1 },
    { text: "ऑन पन्नाद पक्का फ्लेक्स", start: 4.3, end: 6.8 },
    { text: "मार्केट पेरुसु माइंडसेट पुदुसु", start: 7.0, end: 9.9 },
    { text: "टैलेंट काटत नाल कूपन वरसे", start: 10.1, end: 13.0 },
  ],
};

export const StudioEditor: React.FC<StudioEditorProps> = ({
  projectState,
  onBackToCommandCenter,
  sessionId,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(45);
  const [activeLyricIndex, setActiveLyricIndex] = useState<number | null>(null);

  // Language selector state: telugu | english | hindi | dual
  const [selectedLanguage, setSelectedLanguage] = useState<"telugu" | "english" | "hindi" | "dual">(
    projectState.preferred_lang || "dual"
  );

  // Inspector & Styling state
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [animStyle, setAnimStyle] = useState("Kinetic Editorial (Serif)");
  const [lyricOffsetMs, setLyricOffsetMs] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  // Determine active multi-language pack
  const activeMultiLangPack = useMemo<MultiLangPack>(() => {
    if (projectState.lyrics_multilang) {
      return projectState.lyrics_multilang;
    }
    const transcript = (projectState.transcription || "").toLowerCase();
    if (transcript.includes("target") || transcript.includes("trouble")) {
      return TARGET_FIX_MULTILANG;
    }
    return ETU_PONE_MULTILANG;
  }, [projectState]);

  // Current alignment based on selected language (handles Dual Mode)
  const activeAlignment = useMemo<AlignmentEvent[]>(() => {
    if (selectedLanguage === "dual") {
      const primary = activeMultiLangPack.telugu || [];
      const secondary = activeMultiLangPack.english || [];
      return primary.map((item, idx) => ({
        start: item.start,
        end: item.end,
        text: item.text,
        secondaryText: secondary[idx]?.text || "",
      }));
    }
    return activeMultiLangPack[selectedLanguage] || activeMultiLangPack.telugu || [];
  }, [activeMultiLangPack, selectedLanguage]);

  // Track active lyric block
  useEffect(() => {
    const adjustedTime = currentTime + lyricOffsetMs / 1000;
    const idx = activeAlignment.findIndex(
      (ev) => adjustedTime >= ev.start && adjustedTime <= ev.end
    );
    setActiveLyricIndex(idx !== -1 ? idx : null);
  }, [currentTime, activeAlignment, lyricOffsetMs]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const seekTo = (sec: number) => {
    if (!audioRef.current) return;
    const clamped = Math.max(0, Math.min(sec, duration));
    audioRef.current.currentTime = clamped;
    setCurrentTime(clamped);
  };

  const formatTimecode = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 100);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}:${String(ms).padStart(2, "0")}`;
  };

  const handleNudge = (deltaMs: number) => {
    setLyricOffsetMs((prev) => prev + deltaMs);
  };

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setExportComplete(true);
    }, 1800);
  };

  return (
    <div className="w-full min-h-screen bg-[#070908] text-[#EAEFEC] flex flex-col font-sans select-none pb-8">
      {/* Real audio stream element */}
      <audio
        ref={audioRef}
        src="/current_song.mp3"
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onEnded={() => setIsPlaying(false)}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDuration(Math.round(audioRef.current.duration) || 45);
          }
        }}
      />

      {/* ============================================================== */}
      {/* 1. TOP STUDIO BAR */}
      {/* ============================================================== */}
      <nav className="h-16 border-b border-[#18201a] bg-[#090c0a] px-4 flex flex-wrap items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToCommandCenter}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#1e2621] hover:border-[#D4AF37]/50 bg-[#0e1210] hover:bg-[#141b16] text-xs font-mono text-[#D4AF37] transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Command Center</span>
          </button>

          <div className="h-4 w-[1px] bg-[#1e2621]"></div>

          <div className="flex items-center gap-2">
            <span
              className="text-lg font-light tracking-[0.25em] text-[#D4AF37] uppercase"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              GNIX STUDIO
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              SYNCHRONIZED
            </span>
          </div>
        </div>

        {/* Multi-Language Selector Pills (including Dual / Both) */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#0e1210] border border-[#1e2621]">
          <span className="text-[10px] font-mono text-[#8E9992] px-2 flex items-center gap-1">
            <Globe className="w-3 h-3 text-[#D4AF37]" />
            SCRIPT:
          </span>
          <button
            onClick={() => setSelectedLanguage("dual")}
            className={`px-3 py-1 rounded text-xs font-medium transition-all ${
              selectedLanguage === "dual"
                ? "bg-gradient-to-r from-[#D4AF37] to-[#F5E084] text-[#070908] font-bold shadow-[0_0_15px_#D4AF37]"
                : "text-[#F5E084] hover:bg-[#1a231d]"
            }`}
          >
            Dual (Both) ✨
          </button>
          <button
            onClick={() => setSelectedLanguage("telugu")}
            className={`px-3 py-1 rounded text-xs font-medium transition-all ${
              selectedLanguage === "telugu"
                ? "bg-[#D4AF37] text-[#070908] font-bold shadow-[0_0_12px_#D4AF37]"
                : "text-[#8E9992] hover:text-[#EAEFEC]"
            }`}
          >
            తెలుగు (Telugu)
          </button>
          <button
            onClick={() => setSelectedLanguage("english")}
            className={`px-3 py-1 rounded text-xs font-medium transition-all ${
              selectedLanguage === "english"
                ? "bg-[#D4AF37] text-[#070908] font-bold shadow-[0_0_12px_#D4AF37]"
                : "text-[#8E9992] hover:text-[#EAEFEC]"
            }`}
          >
            English
          </button>
          <button
            onClick={() => setSelectedLanguage("hindi")}
            className={`px-3 py-1 rounded text-xs font-medium transition-all ${
              selectedLanguage === "hindi"
                ? "bg-[#D4AF37] text-[#070908] font-bold shadow-[0_0_12px_#D4AF37]"
                : "text-[#8E9992] hover:text-[#EAEFEC]"
            }`}
          >
            हिंदी (Hindi)
          </button>
        </div>

        {/* Master Clock & Export */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-[#0e1210] border border-[#18201a] font-mono text-xs">
            <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span className="text-[#F5E084]">{formatTimecode(currentTime)}</span>
            <span className="text-zinc-600">/</span>
            <span className="text-[#8E9992]">{formatTimecode(duration)}</span>
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#F5E084] hover:brightness-110 text-[#070908] text-xs font-bold tracking-wider uppercase transition-all shadow-[0_0_15px_rgba(212,175,55,0.3)] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#070908]" />
            <span>{isExporting ? "Rendering MP4..." : "Export Master"}</span>
          </button>
        </div>
      </nav>

      {/* ============================================================== */}
      {/* 2. MAIN STAGE & INSPECTOR (SPLIT VIEW) */}
      {/* ============================================================== */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 min-h-[460px]">
        {/* VIDEO PREVIEW CANVAS (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col rounded-xl bg-[#0a0d0b] border border-[#1a221c] p-4 relative overflow-hidden shadow-2xl justify-between">
          {/* Canvas Top Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-[#141b16] z-10">
            <div className="flex items-center gap-2 text-xs font-mono text-[#8E9992]">
              <Video className="w-4 h-4 text-[#D4AF37]" />
              <span>Cinematic Canvas ({aspectRatio})</span>
              <span className="text-[#D4AF37] font-semibold uppercase">
                • {selectedLanguage.toUpperCase()} MODE
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setAspectRatio("16:9")}
                className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                  aspectRatio === "16:9"
                    ? "border-[#D4AF37] bg-[#D4AF37]/15 text-[#F5E084]"
                    : "border-[#1e2621] text-[#8E9992]"
                }`}
              >
                16:9 Cinema
              </button>
              <button
                onClick={() => setAspectRatio("9:16")}
                className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                  aspectRatio === "9:16"
                    ? "border-[#D4AF37] bg-[#D4AF37]/15 text-[#F5E084]"
                    : "border-[#1e2621] text-[#8E9992]"
                }`}
              >
                9:16 Reel
              </button>
            </div>
          </div>

          {/* Video Preview Canvas Stage */}
          <div className="flex-1 flex items-center justify-center my-4 relative">
            <div
              className={`relative rounded-xl overflow-hidden bg-gradient-to-br from-[#0c1410] via-[#070a08] to-[#040605] border border-[#222b25] flex flex-col items-center justify-center p-8 transition-all duration-300 shadow-[0_0_60px_rgba(0,0,0,0.9)] ${
                aspectRatio === "16:9"
                  ? "w-full max-w-2xl aspect-video"
                  : "w-64 aspect-[9/16]"
              }`}
            >
              {/* Generated Video Player when projectState.video is available */}
              {projectState.video ? (
                <video
                  src={projectState.video}
                  controls
                  className="w-full h-full object-contain rounded-xl relative z-20"
                />
              ) : (
                <>
                  {/* Dynamic Aura Ring */}
              <div className="absolute inset-0 pointer-events-none opacity-30 flex items-center justify-center">
                <div
                  className="rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/5 transition-transform duration-100 shadow-[0_0_40px_rgba(212,175,55,0.2)]"
                  style={{
                    width: isPlaying ? `${160 + (currentTime % 1) * 60}px` : "160px",
                    height: isPlaying ? `${160 + (currentTime % 1) * 60}px` : "160px",
                  }}
                />
              </div>

              {/* Dynamic Waveform Spectrum at bottom of canvas */}
              <div className="absolute bottom-6 left-12 right-12 h-8 flex items-end justify-center gap-1 opacity-40 pointer-events-none">
                {Array.from({ length: 32 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-[#D4AF37] rounded-full transition-all duration-75"
                    style={{
                      height: isPlaying
                        ? `${Math.abs(Math.sin(currentTime * 5 + i * 0.4)) * 90 + 10}%`
                        : "15%",
                    }}
                  />
                ))}
              </div>

              {/* Dynamic Synchronized Lyrics Overlay (Supports Dual Mode) */}
              <div className="relative z-10 text-center max-w-lg px-6">
                {activeLyricIndex !== null && activeAlignment[activeLyricIndex] ? (
                  <div className="space-y-2 animate-fade-in">
                    <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-[#D4AF37]/90 bg-black/60 px-3 py-1 rounded-full inline-block border border-[#D4AF37]/30">
                      ONSET LOCK [{activeAlignment[activeLyricIndex].start.toFixed(2)}s]
                    </p>

                    {selectedLanguage === "dual" ? (
                      <div className="space-y-1.5">
                        <h2
                          className="text-2xl sm:text-3xl font-medium tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-[#FFFFFF] via-[#F5E084] to-[#D4AF37] leading-relaxed drop-shadow-[0_4px_25px_rgba(212,175,55,0.5)]"
                          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                        >
                          “{activeAlignment[activeLyricIndex].text}”
                        </h2>
                        {activeAlignment[activeLyricIndex].secondaryText && (
                          <p
                            className="text-sm sm:text-base text-[#F5E084]/80 italic tracking-wider drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]"
                            style={{ fontFamily: "var(--font-serif)" }}
                          >
                            ({activeAlignment[activeLyricIndex].secondaryText})
                          </p>
                        )}
                      </div>
                    ) : (
                      <h2
                        className="text-3xl sm:text-4xl font-normal tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-[#FFFFFF] via-[#F5E084] to-[#D4AF37] leading-relaxed drop-shadow-[0_4px_25px_rgba(212,175,55,0.5)]"
                        style={{
                          fontFamily:
                            selectedLanguage === "telugu"
                              ? "'Plus Jakarta Sans', sans-serif"
                              : animStyle.includes("Serif")
                              ? "var(--font-serif)"
                              : "var(--font-sans)",
                        }}
                      >
                        “{activeAlignment[activeLyricIndex].text}”
                      </h2>
                    )}
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <Disc3 className="w-8 h-8 text-[#D4AF37] mx-auto animate-spin" style={{ animationDuration: "8s" }} />
                    <p className="text-xs font-mono text-[#D4AF37]/80 tracking-widest uppercase">
                      — GNIX PRECISION MOTION ENGINE —
                    </p>
                    <p className="text-[11px] text-[#8E9992] font-mono">
                      Press Play to hear audio & watch {selectedLanguage.toUpperCase()} lyrics sync in real-time
                    </p>
                  </div>
                )}
              </div>

              {/* Frame Specs in Corner */}
              <div className="absolute top-3 right-3 text-[10px] font-mono text-[#8E9992]/80 bg-black/60 px-2 py-0.5 rounded border border-white/5">
                48kHz • 10ms LOCK
              </div>
                </>
              )}
            </div>
          </div>

          {/* Transport Controls Bar */}
          <div className="flex items-center justify-between pt-3 border-t border-[#141b16] z-10">
            <div className="flex items-center gap-2">
              <button
                onClick={() => seekTo(12)}
                className="p-2 rounded-lg border border-[#1e2621] hover:border-[#D4AF37]/50 text-[#8E9992] hover:text-[#EAEFEC] transition-colors"
                title="Chorus Start (0:12)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => seekTo(currentTime - 2)}
                className="p-2 rounded-lg border border-[#1e2621] hover:border-[#D4AF37]/50 text-[#8E9992] hover:text-[#EAEFEC] transition-colors"
                title="-2s"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={togglePlay}
                className="flex items-center justify-center w-11 h-11 rounded-full bg-[#D4AF37] hover:bg-[#F5E084] text-[#070908] shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-transform hover:scale-105 cursor-pointer"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>
              <button
                onClick={() => seekTo(currentTime + 2)}
                className="p-2 rounded-lg border border-[#1e2621] hover:border-[#D4AF37]/50 text-[#8E9992] hover:text-[#EAEFEC] transition-colors"
                title="+2s"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-[#8E9992]">AUDIO STREAM:</span>
              <span className="text-emerald-400">ACTIVE (44.1kHz STEREO)</span>
              <span className="text-[#D4AF37]">
                OFFSET: {lyricOffsetMs > 0 ? `+${lyricOffsetMs}` : lyricOffsetMs}ms
              </span>
            </div>
          </div>
        </div>

        {/* STUDIO INSPECTOR PANEL (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col rounded-xl bg-[#0a0d0b] border border-[#1a221c] p-4 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 pb-3 border-b border-[#141b16]">
            <Sliders className="w-4 h-4 text-[#D4AF37]" />
            <h3
              className="text-sm uppercase tracking-wider text-[#EAEFEC] font-medium"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Master Inspector
            </h3>
          </div>

          {/* Language Switcher in Inspector */}
          <div className="p-3.5 rounded-lg bg-[#070908] border border-[#18201a] space-y-2">
            <span className="text-xs font-mono text-[#8E9992] flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#D4AF37]" />
              Display Lyrics Mode
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setSelectedLanguage("dual")}
                className={`py-2 px-2 rounded text-xs transition-colors font-medium ${
                  selectedLanguage === "dual"
                    ? "bg-[#D4AF37] text-black font-bold shadow-[0_0_10px_#D4AF37]"
                    : "bg-[#0e1210] border border-[#18201a] text-[#8E9992] hover:text-[#EAEFEC]"
                }`}
              >
                Dual (Both) ✨
              </button>
              <button
                onClick={() => setSelectedLanguage("telugu")}
                className={`py-2 px-2 rounded text-xs transition-colors font-medium ${
                  selectedLanguage === "telugu"
                    ? "bg-[#D4AF37] text-black font-bold shadow-[0_0_10px_#D4AF37]"
                    : "bg-[#0e1210] border border-[#18201a] text-[#8E9992] hover:text-[#EAEFEC]"
                }`}
              >
                తెలుగు
              </button>
              <button
                onClick={() => setSelectedLanguage("english")}
                className={`py-2 px-2 rounded text-xs transition-colors font-medium ${
                  selectedLanguage === "english"
                    ? "bg-[#D4AF37] text-black font-bold shadow-[0_0_10px_#D4AF37]"
                    : "bg-[#0e1210] border border-[#18201a] text-[#8E9992] hover:text-[#EAEFEC]"
                }`}
              >
                English
              </button>
              <button
                onClick={() => setSelectedLanguage("hindi")}
                className={`py-2 px-2 rounded text-xs transition-colors font-medium ${
                  selectedLanguage === "hindi"
                    ? "bg-[#D4AF37] text-black font-bold shadow-[0_0_10px_#D4AF37]"
                    : "bg-[#0e1210] border border-[#18201a] text-[#8E9992] hover:text-[#EAEFEC]"
                }`}
              >
                हिंदी
              </button>
            </div>
          </div>

          {/* Micro-Timing Offset Controls */}
          <div className="p-3.5 rounded-lg bg-[#070908] border border-[#18201a] space-y-2">
            <span className="text-xs font-mono text-[#8E9992] block">
              10ms Sub-Frame Nudge
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleNudge(-50)}
                className="py-1.5 rounded bg-[#101412] hover:bg-[#161c18] border border-[#1e2621] hover:border-[#D4AF37]/50 text-xs font-mono text-[#EAEFEC]"
              >
                -50ms
              </button>
              <button
                onClick={() => setLyricOffsetMs(0)}
                className="py-1.5 rounded bg-[#101412] hover:bg-[#161c18] border border-[#1e2621] hover:border-[#D4AF37]/50 text-xs font-mono text-[#D4AF37]"
              >
                Reset
              </button>
              <button
                onClick={() => handleNudge(50)}
                className="py-1.5 rounded bg-[#101412] hover:bg-[#161c18] border border-[#1e2621] hover:border-[#D4AF37]/50 text-xs font-mono text-[#EAEFEC]"
              >
                +50ms
              </button>
            </div>
          </div>

          {/* Typography Styling Presets */}
          <div className="p-3.5 rounded-lg bg-[#070908] border border-[#18201a] space-y-2">
            <span className="text-xs font-mono text-[#8E9992] flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-[#D4AF37]" />
              Animation Stems
            </span>
            <div className="space-y-1.5">
              {[
                "Kinetic Editorial (Serif)",
                "Cyber Obsidian (Monospace)",
                "Minimalist Clean (Sans)",
                "Gold Dust Dissolve",
              ].map((style) => (
                <button
                  key={style}
                  onClick={() => setAnimStyle(style)}
                  className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors flex items-center justify-between ${
                    animStyle === style
                      ? "bg-[#D4AF37]/15 border border-[#D4AF37]/50 text-[#F5E084]"
                      : "bg-[#0e1210] border border-[#18201a] text-[#8E9992] hover:text-[#EAEFEC]"
                  }`}
                >
                  <span>{style}</span>
                  {animStyle === style && <Check className="w-3 h-3 text-[#D4AF37]" />}
                </button>
              ))}
            </div>
          </div>

          {/* Direct Video File Ready Box */}
          <div className="p-3.5 rounded-lg bg-[#070908] border border-[#18201a] text-xs font-mono space-y-2">
            <p className="text-[#D4AF37] font-medium flex items-center gap-1.5">
              <FileVideo className="w-3.5 h-3.5" />
              Direct Master Video MP4
            </p>
            <p className="text-[10px] text-[#8E9992]">
              Rendered with FFmpeg & synchronized audio.
            </p>
            {projectState.video ? (
              <a
                href={projectState.video}
                download="gnix_master_video.mp4"
                className="inline-flex items-center gap-2 px-3 py-2 rounded bg-[#D4AF37] text-black font-bold uppercase text-[11px] hover:bg-[#F5E084] transition-colors w-full justify-center shadow-[0_0_12px_rgba(212,175,55,0.3)]"
              >
                <Download className="w-3.5 h-3.5" />
                Download MP4 File
              </a>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded bg-[#141b16] text-[#8E9992] font-mono text-[11px] w-full justify-center border border-[#1e2621]">
                No video generated yet
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. MULTI-TRACK PROFESSIONAL TIMELINE */}
      {/* ============================================================== */}
      <section className="mx-4 p-4 rounded-xl bg-[#090c0a] border border-[#1a221c] space-y-3">
        <div className="flex items-center justify-between text-xs font-mono text-[#8E9992]">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#D4AF37]" />
            <span className="uppercase tracking-wider text-[#EAEFEC]">
              Multi-Track Timeline (10ms Precision) • {selectedLanguage.toUpperCase()}
            </span>
          </div>
          <span>Playhead: {formatTimecode(currentTime)}</span>
        </div>

        {/* Timeline Tracks Container */}
        <div className="relative bg-[#050706] rounded-lg border border-[#161d18] p-3 space-y-2 overflow-hidden">
          {/* TRACK 1: Video / B-Roll Stems */}
          <div className="relative h-10 bg-[#0e1411] rounded border border-[#1a241e] flex items-center px-3">
            <span className="text-[10px] font-mono text-[#8E9992] w-20 flex-shrink-0">
              V1 : B-Roll
            </span>
            <div className="flex-1 h-7 bg-[#141d18] border border-[#D4AF37]/30 rounded flex items-center px-3 text-[11px] text-[#F5E084] font-mono truncate">
              Cinematic Obsidian Montage (Universal Sync)
            </div>
          </div>

          {/* TRACK 2: Aligned Lyrics in Selected Language */}
          <div className="relative h-12 bg-[#0e1411] rounded border border-[#1a241e] flex items-center px-3">
            <span className="text-[10px] font-mono text-[#8E9992] w-20 flex-shrink-0">
              L1 : {selectedLanguage.slice(0, 4).toUpperCase()}
            </span>
            <div className="flex-1 relative h-8 overflow-hidden">
              {activeAlignment.map((ev, i) => {
                const leftPct = (ev.start / duration) * 100;
                const widthPct = Math.max(8, ((ev.end - ev.start) / duration) * 100);
                const isActive = activeLyricIndex === i;
                return (
                  <div
                    key={i}
                    onClick={() => seekTo(ev.start)}
                    className={`absolute top-0 bottom-0 rounded px-2 flex items-center text-[10px] font-mono truncate cursor-pointer transition-all border ${
                      isActive
                        ? "bg-[#D4AF37] text-[#070908] border-[#F5E084] font-bold shadow-[0_0_12px_#D4AF37]"
                        : "bg-[#18231c] text-[#D4AF37] border-[#D4AF37]/30 hover:border-[#D4AF37]"
                    }`}
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                    }}
                    title={`${ev.text} (${ev.start}s - ${ev.end}s)`}
                  >
                    {ev.text}
                  </div>
                );
              })}
            </div>
          </div>

          {/* TRACK 3: Audio Waveform Stem */}
          <div className="relative h-10 bg-[#0e1411] rounded border border-[#1a241e] flex items-center px-3">
            <span className="text-[10px] font-mono text-[#8E9992] w-20 flex-shrink-0">
              A1 : Vocals
            </span>
            <div className="flex-1 h-6 flex items-center gap-0.5">
              {Array.from({ length: 80 }).map((_, idx) => (
                <div
                  key={idx}
                  className="flex-1 rounded-sm bg-[#D4AF37]/20"
                  style={{
                    height: `${Math.abs(Math.sin(idx * 0.3)) * 80 + 20}%`,
                    backgroundColor:
                      (idx / 80) * duration <= currentTime
                        ? "#D4AF37"
                        : "rgba(212, 175, 55, 0.2)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Scrubber Playhead line spanning all tracks */}
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-red-400 pointer-events-none shadow-[0_0_10px_#f87171] z-20"
            style={{
              left: `calc(5.5rem + ${(currentTime / duration) * (100 - 15)}%)`,
            }}
          />
        </div>
      </section>
    </div>
  );
};
