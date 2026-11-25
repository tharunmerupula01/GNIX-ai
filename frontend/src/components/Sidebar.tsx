"use client";

import React, { useState } from "react";
import { Plus, Trash2, Folder, Search, Radio, CheckCircle, Disc3, X } from "lucide-react";

interface SidebarProps {
  sessions: string[];
  activeSession: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSession,
  onSelect,
  onNew,
  onDelete,
  isOpen,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSessions = sessions.filter((s) =>
    s.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 w-72 bg-[#090c0a] border-r border-[#1a211c] flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-[#18201a] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Disc3 className="w-4 h-4 text-[#D4AF37] animate-spin" style={{ animationDuration: "12s" }} />
            <h2
              className="text-base uppercase tracking-wider text-[#EAEFEC] font-medium"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Session Archive
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#8E9992] hover:text-[#EAEFEC] lg:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New Session Action */}
        <div className="p-4 border-b border-[#18201a]">
          <button
            onClick={onNew}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#D4AF37]/15 via-[#D4AF37]/25 to-[#D4AF37]/15 hover:from-[#D4AF37]/25 hover:via-[#D4AF37]/35 hover:to-[#D4AF37]/25 border border-[#D4AF37]/40 text-[#F5E084] text-xs font-medium tracking-wider uppercase transition-all shadow-[0_0_15px_rgba(212,175,55,0.1)] group"
          >
            <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-200" />
            <span>New Master Take</span>
          </button>
        </div>

        {/* Filter Search */}
        <div className="p-3 border-b border-[#141b16]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8E9992]" />
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#0f1411] border border-[#1e2621] rounded-md text-xs text-[#EAEFEC] placeholder-[#8E9992]/60 focus:outline-none focus:border-[#D4AF37]/50 font-mono transition-colors"
            />
          </div>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredSessions.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#8E9992]">
              <Folder className="w-8 h-8 mx-auto mb-2 opacity-30 text-[#D4AF37]" />
              <p>No active sessions found.</p>
              <p className="text-[10px] text-[#8E9992]/70 mt-1">Start a new project above.</p>
            </div>
          ) : (
            filteredSessions.map((id) => {
              const isActive = activeSession === id;
              return (
                <div
                  key={id}
                  onClick={() => onSelect(id)}
                  className={`group relative flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    isActive
                      ? "bg-[#141b16] border-[#D4AF37]/50 text-[#F5E084] shadow-[0_0_12px_rgba(212,175,55,0.12)]"
                      : "bg-[#0b0e0c] border-[#161c18] text-[#8E9992] hover:bg-[#101512] hover:border-[#222b24] hover:text-[#EAEFEC]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <Radio
                      className={`w-3 h-3 flex-shrink-0 ${
                        isActive ? "text-[#D4AF37] animate-pulse" : "text-[#8E9992]/50"
                      }`}
                    />
                    <div className="truncate">
                      <p className="font-mono text-xs truncate">
                        {id}
                      </p>
                      <p className="text-[10px] text-[#8E9992]/70 flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 inline-block"></span>
                        Synchronized
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete session "${id}" from disk?`)) {
                        onDelete(id);
                      }
                    }}
                    title="Delete Session"
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-all flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hardware Spec */}
        <div className="p-3 border-t border-[#18201a] bg-[#070908] text-[10px] text-[#8E9992] font-mono flex items-center justify-between">
          <span>STORAGE: FAST DISK</span>
          <span className="text-[#D4AF37]">GNIX_MEMORY.JSON</span>
        </div>
      </aside>
    </>
  );
};
