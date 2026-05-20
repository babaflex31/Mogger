import React from 'react';

// TechnicalPanel: displays real‑time AI metrics with a premium glass‑morphism design
// Props:
//   scores: object containing raw metrics and finalScore
//   combatType: string label of the current combat type
export default function TechnicalPanel({ scores, combatType }) {
  const {
    symmetry,
    jawline,
    canthalTilt,
    mewing,
    hunterGaze,
    browCompactness,
    midfaceRatio,
    lipRatio,
    facialThirds,
    finalScore,
  } = scores || {};

  // Helper to safely render a metric value
  const fmt = (value) => (value !== undefined && value !== null ? value.toFixed(1) : '--');

  return (
    <div className="technical-panel glassmorphic">
      <h2 className="panel-title text-neon-glow">Technical Dashboard</h2>
      <div className="panel-section">
        <div className="panel-row">
          <span>Combat:</span> <span className="text-neon-cyan">{combatType || '—'}</span>
        </div>
        <div className="panel-row">
          <span>Final Score:</span> <span className="text-neon-glow">{fmt(finalScore)}</span>
        </div>
      </div>
      <div className="panel-section metrics-grid">
        <div className="metric-item"><span>Symmetry</span> <span>{fmt(symmetry)}</span></div>
        <div className="metric-item"><span>Jawline</span> <span>{fmt(jawline)}</span></div>
        <div className="metric-item"><span>Canthal Tilt</span> <span>{fmt(canthalTilt)}</span></div>
        <div className="metric-item"><span>Mewing</span> <span>{fmt(mewing)}</span></div>
        <div className="metric-item"><span>Hunter Gaze</span> <span>{fmt(hunterGaze)}</span></div>
        <div className="metric-item"><span>Brow Compactness</span> <span>{fmt(browCompactness)}</span></div>
        <div className="metric-item"><span>Mid‑face Ratio</span> <span>{fmt(midfaceRatio)}</span></div>
        <div className="metric-item"><span>Lip Ratio</span> <span>{fmt(lipRatio)}</span></div>
        <div className="metric-item"><span>Facial Thirds</span> <span>{fmt(facialThirds)}</span></div>
      </div>
    </div>
  );
}
