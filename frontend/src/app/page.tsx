"use client";

import React, { useState, useEffect } from "react";
import { GnixAtmosphere } from "@/components/GnixAtmosphere";
import { GnixDivider } from "@/components/GnixDivider";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { IntakeDeck } from "@/components/IntakeDeck";
import { StudioEditor } from "@/components/StudioEditor";

export default function Home() {
  const [sessions, setSessions] = useState<string[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<"intake" | "studio">("intake");
  const [activeProjectState, setActiveProjectState] = useState<any>(null);

  // Fetch persisted sessions from backend on mount
  const refreshSessions = async () => {
    try {
      let res: Response;
      try {
        res = await fetch("/api/sessions");
      } catch {
        res = await fetch("http://127.0.0.1:8000/api/sessions");
      }
      if (res.ok) {
        const data = await res.json();
        const list: string[] = data.sessions || [];
        setSessions(list);
        if (list.length > 0 && !activeSession) {
          setActiveSession(list[0]);
        }
      }
    } catch {
      // Fallback empty list if backend is momentarily reloading
    }
  };

  useEffect(() => {
    refreshSessions();
  }, []);

  const handleNewSession = () => {
    const newId = `session-${Date.now().toString().slice(-6)}`;
    setSessions((prev) => [newId, ...prev]);
    setActiveSession(newId);
    setCurrentScreen("intake");
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await fetch(`http://127.0.0.1:8000/api/sessions/${id}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.warn("Delete request error:", err);
    }
    setSessions((prev) => prev.filter((s) => s !== id));
    if (activeSession === id) {
      setActiveSession(null);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#070908] text-[#EAEFEC] flex overflow-x-hidden selection:bg-[#D4AF37]/30 selection:text-[#F5E084]">
      {/* 60fps Gold Dust Ambient Canvas */}
      <GnixAtmosphere />

      {/* Screen 2: Full Screen Studio Editor Mode */}
      {currentScreen === "studio" && activeProjectState ? (
        <div className="relative z-10 w-full min-h-screen">
          <StudioEditor
            projectState={activeProjectState}
            sessionId={activeSession || "default"}
            onBackToCommandCenter={() => setCurrentScreen("intake")}
          />
        </div>
      ) : (
        /* Screen 1: Command Center & Intake Deck */
        <>
          {/* Persistent Sessions Archive Sidebar */}
          <Sidebar
            sessions={sessions}
            activeSession={activeSession}
            onSelect={(id) => {
              setActiveSession(id);
              setSidebarOpen(false);
            }}
            onNew={handleNewSession}
            onDelete={handleDeleteSession}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          {/* Main Workspace Viewport */}
          <div className="relative z-10 flex-1 flex flex-col min-h-screen overflow-y-auto">
            <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-6 flex flex-col">
              {/* Pro Editorial Header */}
              <Header
                onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                sidebarOpen={sidebarOpen}
              />

              {/* Shimmering Champagne-Gold Divider */}
              <GnixDivider />

              {/* The Gnix Command Center: Intake Deck */}
              <div className="flex-1 mt-2">
                <IntakeDeck
                  activeSessionId={activeSession}
                  onSessionCreated={(id) => {
                    if (!sessions.includes(id)) {
                      setSessions((prev) => [id, ...prev]);
                    }
                    setActiveSession(id);
                  }}
                  onLaunchStudio={(state) => {
                    setActiveProjectState(state);
                    setCurrentScreen("studio");
                  }}
                />
              </div>
            </main>
          </div>
        </>
      )}
    </div>
  );
}
