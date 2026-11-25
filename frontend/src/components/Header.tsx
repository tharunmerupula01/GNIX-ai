"use client";

import React, { useState, useEffect } from "react";
import { Cpu, Activity, Clock, ShieldCheck, Sliders, Volume2, Sparkles } from "lucide-react";

interface HeaderProps {
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, sidebarOpen }) => {
  const [timecode, setTimecode] = useState("00:00:00:00");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hrs = String(now.getHours()).padStart(2, "0");
      const mins = String(now.getMinutes()).padStart(2, "0");
      const secs = String(now.getSeconds()).padStart(2, "0");
      const frames = String(Math.floor((now.getMilliseconds() / 1000) * 30)).padStart(2, "0");
      setTimecode(`${hrs}:${mins}:${secs}:${frames}`);
    };
    const interval = setInterval(updateTime, 33);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="relative w-full z-20 flex flex-col md:flex-row items-center justify-between gap-4 pb-4 border-b border-[#1c241f]">
      {/* Brand & Editorial Tagline */}
      <div className="flex items-center gap-6">
        <button
          onClick={onToggleSidebar}
          title="Toggle Project Drawer"
          className="p-2.5 rounded-lg border border-[#1e2621] hover:border-[#D4AF37]/50 bg-[#0e1210] hover:bg-[#151c17] transition-all text-[#D4AF37]"
        >
          <Sliders className="w-4 h-4" />
        </button>

        <div>
          <div className="flex items-baseline gap-3">
            <h1
              className="text-3xl font-light tracking-[0.3em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-[#F5E084] via-[#D4AF37] to-[#AA8220]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              GNIX
            </h1>
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] px-2 py-0.5 rounded border border-[#D4AF37]/30 text-[#D4AF37] bg-[#D4AF37]/5">
              PRO STUDIO v2.4
            </span>
          </div>
          <p
            className="text-xs italic tracking-wide text-[#8E9992] mt-0.5"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Where Sound Meets Precision — More Than Video.
          </p>
        </div>
      </div>

      {/* Hardware Status & Timecode Engine */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Timecode Clock */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#0a0d0b] border border-[#1c241f] text-[#8E9992] text-xs font-mono">
          <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span className="text-[#D4AF37]/90">{timecode}</span>
        </div>

        {/* Engine Precision Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#0a0d0b] border border-[#1c241f] text-xs font-mono">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-zinc-400">SYNC:</span>
          <span className="text-emerald-400 font-medium">10ms Sub-Frame</span>
        </div>

        {/* RTX 4050 GPU Status */}
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-md bg-[#0e1411] border border-emerald-500/25 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <Cpu className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-medium text-emerald-200 tracking-wide font-mono">
            RTX 4050 VRAM Ready
          </span>
          <span className="hidden md:inline-block text-[10px] text-emerald-400/70 border-l border-emerald-500/20 pl-2">
            CUDA 6GB
          </span>
        </div>
      </div>
    </header>
  );
};
