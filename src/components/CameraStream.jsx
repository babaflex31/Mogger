import React, { useEffect, useRef } from 'react';
import { ShieldAlert, Crosshair, Sparkles } from 'lucide-react';

export default function CameraStream({
  stream,
  isLocal,
  canvasRef,
  scores,
  combatType,
  fraudAlerts,
  playerName
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const hasScore = scores && scores.finalScore > 0;
  const isDisqualified = fraudAlerts && fraudAlerts.disqualified;

  return (
    <div className="relative w-full aspect-video md:aspect-[4/3] rounded-lg overflow-hidden border-2 border-zinc-800 bg-black scanlines shadow-2xl">
      {/* Video Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
      />

      {/* MediaPipe Canvas Overlay */}
      <canvas
        ref={canvasRef}
        className={`absolute top-0 left-0 w-full h-full pointer-events-none ${isLocal ? 'scale-x-[-1]' : ''}`}
      />

      {/* Cyber Overlay Details */}
      <div className="absolute top-3 left-3 bg-black/75 px-3 py-1 text-xs border border-neon-red/40 rounded flex items-center gap-2 font-mono uppercase tracking-widest text-neon-red shadow-lg crt-flicker">
        <span className="w-2 h-2 rounded-full bg-neon-red animate-pulse" />
        {isLocal ? 'LOCAL FEED // ANGLE_CHECKER' : `PEER: ${playerName || 'OPPONENT'}`}
      </div>

      {/* Active Battle Score HUD */}
      {hasScore && !isDisqualified && (
        <div className="absolute bottom-3 left-3 right-3 flex flex-col gap-2 pointer-events-none">
          {/* Main Combat Type Badge */}
          <div className="flex justify-between items-end">
            <span className="bg-neon-red/90 text-black font-black text-xs px-2 py-0.5 rounded tracking-widest font-display flex items-center gap-1 shadow-lg">
              <Sparkles className="w-3.5 h-3.5" />
              {combatType}
            </span>
            <div className="bg-black/90 px-3 py-1 border border-neon-cyan/50 text-neon-cyan rounded font-mono text-xl font-black text-neon-cyan tracking-wider">
              {scores.finalScore} <span className="text-[10px] font-normal">MOG</span>
            </div>
          </div>

          {/* Mini Diagnostic Gauges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-black/85 p-2 rounded border border-zinc-800 backdrop-blur-sm text-[9px] font-mono tracking-tighter">
            {/* Canthal Tilt */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between font-bold">
                <span>CANTHAL TILT:</span>
                <span className={scores.canthalTilt >= 0 ? 'text-neon-cyan' : 'text-neon-red'}>
                  {scores.canthalTilt >= 0 ? '+' : ''}{scores.canthalTilt}°
                </span>
              </div>
              <div className="w-full h-1 bg-zinc-900 rounded overflow-hidden">
                <div 
                  className={`h-full ${scores.canthalTilt >= 0 ? 'bg-neon-cyan' : 'bg-neon-red'}`} 
                  style={{ width: `${Math.min(100, Math.max(10, ((scores.canthalTilt + 5) / 10) * 100))}%` }} 
                />
              </div>
            </div>

            {/* Symmetry */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between font-bold">
                <span>SYMMETRY:</span>
                <span className="text-neon-cyan">{scores.symmetry}%</span>
              </div>
              <div className="w-full h-1 bg-zinc-900 rounded overflow-hidden">
                <div className="h-full bg-neon-cyan" style={{ width: `${scores.symmetry}%` }} />
              </div>
            </div>

            {/* Jawline */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between font-bold">
                <span>JAWLINE:</span>
                <span className="text-neon-cyan">{scores.jawline}%</span>
              </div>
              <div className="w-full h-1 bg-zinc-900 rounded overflow-hidden">
                <div className="h-full bg-neon-cyan" style={{ width: `${scores.jawline}%` }} />
              </div>
            </div>

            {/* Mewing */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between font-bold">
                <span>MEWING:</span>
                <span className="text-neon-cyan">{scores.mewing}%</span>
              </div>
              <div className="w-full h-1 bg-zinc-900 rounded overflow-hidden">
                <div className="h-full bg-neon-cyan" style={{ width: `${scores.mewing}%` }} />
              </div>
            </div>

            {/* Hunter Gaze */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between font-bold">
                <span>HUNTER GAZE:</span>
                <span className="text-neon-cyan">{scores.hunterGaze || 0}%</span>
              </div>
              <div className="w-full h-1 bg-zinc-900 rounded overflow-hidden">
                <div className="h-full bg-neon-cyan" style={{ width: `${scores.hunterGaze || 0}%` }} />
              </div>
            </div>

            {/* Brow Compactness */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between font-bold">
                <span>BROW COMPACT:</span>
                <span className="text-neon-cyan">{scores.browCompactness || 0}%</span>
              </div>
              <div className="w-full h-1 bg-zinc-900 rounded overflow-hidden">
                <div className="h-full bg-neon-cyan" style={{ width: `${scores.browCompactness || 0}%` }} />
              </div>
            </div>

            {/* Midface Ratio */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between font-bold">
                <span>MIDFACE RATIO:</span>
                <span className="text-neon-cyan">{scores.midfaceRatio || 0}%</span>
              </div>
              <div className="w-full h-1 bg-zinc-900 rounded overflow-hidden">
                <div className="h-full bg-neon-cyan" style={{ width: `${scores.midfaceRatio || 0}%` }} />
              </div>
            </div>

            {/* Lip Ratio */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between font-bold">
                <span>LIPS/NOSE RATIO:</span>
                <span className="text-neon-cyan">{scores.lipRatio || 0}%</span>
              </div>
              <div className="w-full h-1 bg-zinc-900 rounded overflow-hidden">
                <div className="h-full bg-neon-cyan" style={{ width: `${scores.lipRatio || 0}%` }} />
              </div>
            </div>

            {/* Facial Thirds */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between font-bold">
                <span>FACIAL THIRDS:</span>
                <span className="text-neon-cyan">{scores.facialThirds || 0}%</span>
              </div>
              <div className="w-full h-1 bg-zinc-900 rounded overflow-hidden">
                <div className="h-full bg-neon-cyan" style={{ width: `${scores.facialThirds || 0}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Disqualification / Fraud Flashing Alert Overlay */}
      {isDisqualified && (
        <div className="absolute inset-0 bg-red-950/80 border-4 border-neon-red flex flex-col justify-center items-center gap-3 p-4 animate-pulse">
          <ShieldAlert className="w-16 h-16 text-neon-red animate-bounce" />
          <div className="text-center font-display">
            <h3 className="text-xl font-black text-neon-red tracking-widest glitch-text" data-text="FRAUD DETECTED">
              FRAUD DETECTED
            </h3>
            <p className="text-xs text-white/80 font-mono mt-1 uppercase">
              {fraudAlerts.angleAbuse ? 'ANGLE MERCHANT // RE-ALIGN REQUIRED' : 'FILTER ABUSE // RAW ONLY'}
            </p>
          </div>
          <div className="bg-black text-neon-red border border-neon-red font-mono px-3 py-1 text-[10px] rounded mt-2 uppercase tracking-wide">
            WARNING: MOG DISQUALIFICATION ACTIVE
          </div>
        </div>
      )}

      {/* Loading or Waiting Stream State */}
      {!stream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 text-zinc-500 font-mono text-sm gap-2">
          <Crosshair className="w-8 h-8 animate-spin text-neon-red" />
          <span className="tracking-widest text-[10px] text-zinc-400">CONNECTING VIDEO STREAM...</span>
        </div>
      )}
    </div>
  );
}
