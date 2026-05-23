import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';

// TechnicalPanel: displays real‑time AI metrics with a premium glass‑morphism design
// Props:
//   scores: object containing raw metrics and finalScore
//   combatType: string label of the current combat type
function TechnicalPanel({ scores, combatType }) {
  const { t } = useTranslation();
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
      <h2 className="panel-title text-neon-glow">{t('technical_dashboard')}</h2>
      <div className="panel-section">
        <div className="panel-row">
          <span>{t('combat_t')}</span> <span className="text-neon-cyan">{combatType ? t(combatType, combatType) : '—'}</span>
        </div>
        <div className="panel-row">
          <span>{t('final_score_t')}</span> <span className="text-neon-glow">{fmt(finalScore)}</span>
        </div>
      </div>
      <div className="panel-section metrics-grid">
        <div className="metric-item"><span>{t('symmetry_t')}</span> <span>{fmt(symmetry)}</span></div>
        <div className="metric-item"><span>{t('jawline_t')}</span> <span>{fmt(jawline)}</span></div>
        <div className="metric-item"><span>{t('canthal_tilt_t')}</span> <span>{fmt(canthalTilt)}</span></div>
        <div className="metric-item"><span>{t('mewing_t')}</span> <span>{fmt(mewing)}</span></div>
        <div className="metric-item"><span>{t('hunter_gaze_t')}</span> <span>{fmt(hunterGaze)}</span></div>
        <div className="metric-item"><span>{t('brow_compactness_t')}</span> <span>{fmt(browCompactness)}</span></div>
        <div className="metric-item"><span>{t('midface_ratio_t')}</span> <span>{fmt(midfaceRatio)}</span></div>
        <div className="metric-item"><span>{t('lip_ratio_t')}</span> <span>{fmt(lipRatio)}</span></div>
        <div className="metric-item"><span>{t('facial_thirds_t')}</span> <span>{fmt(facialThirds)}</span></div>
      </div>
    </div>
  );
}

export default TechnicalPanel;
