"use client";

import React, { useRef, useEffect } from "react";

export const GnixAtmosphere: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    const count = 45;
    const particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -Math.random() * 0.35 - 0.05, // subtle rising drift
      size: Math.random() * 1.6 + 0.6,
      alpha: Math.random() * 0.35 + 0.1,
      fadeSpeed: (Math.random() * 0.005 + 0.002) * (Math.random() > 0.5 ? 1 : -1),
    }));

    let raf: number;
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Subtle radial vignetted glow at center top
      const grad = ctx.createRadialGradient(
        width / 2,
        height * 0.15,
        10,
        width / 2,
        height * 0.3,
        width * 0.6
      );
      grad.addColorStop(0, "rgba(212, 175, 55, 0.04)");
      grad.addColorStop(1, "rgba(7, 9, 8, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Render floating gold motes
      particles.forEach((p) => {
        p.alpha += p.fadeSpeed;
        if (p.alpha <= 0.05 || p.alpha >= 0.45) {
          p.fadeSpeed = -p.fadeSpeed;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212, 175, 55, ${p.alpha})`;
        ctx.shadowColor = "rgba(212, 175, 55, 0.4)";
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;

        p.x += p.vx;
        p.y += p.vy;

        if (p.y < -10) p.y = height + 10;
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
      });

      raf = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      {/* Background canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-0"
      />

      {/* Architectural side hairlines */}
      <div className="fixed top-0 bottom-0 left-0 w-[1px] bg-gradient-to-b from-transparent via-[#D4AF37]/20 to-transparent pointer-events-none z-10" />
      <div className="fixed top-0 bottom-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-[#D4AF37]/20 to-transparent pointer-events-none z-10" />
      
      {/* Top ambient illumination */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent pointer-events-none z-10" />
    </>
  );
};
