"use client";

import React from "react";

export const GnixDivider: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`relative w-full my-6 flex items-center justify-center ${className}`}>
    <div className="relative w-full h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/25 to-transparent overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#F3E5AB]/60 to-transparent animate-shimmer" />
    </div>
    <div className="absolute w-1.5 h-1.5 rotate-45 bg-[#D4AF37] border border-[#070908] shadow-[0_0_8px_#D4AF37]" />
  </div>
);
