export const CONFIG = {
  // Game Settings
  DEFAULT_MATCH_DURATION: 30,
  FALLBACK_WEBRTC_TIMEOUT_MS: 5000,
  
  // ELO System
  ELO_GAIN: 25,
  ELO_LOSS: -20,
  
  // Looksmaxxing AI Weights (must sum to 1.0)
  WEIGHTS: {
    SYMMETRY: 0.15,
    JAWLINE: 0.15,
    CANTHAL_TILT: 0.15,
    MEWING: 0.10,
    HUNTER_GAZE: 0.15,
    BROW_COMPACTNESS: 0.10,
    MIDFACE_RATIO: 0.10,
    LIP_RATIO: 0.05,
    FACIAL_THIRDS: 0.05
  },

  // Combat Types (Keys for i18n)
  COMBAT_TYPES: {
    SCANDINAVIAN: "scandinavian_mogger",
    PREDATOR: "predator_type",
    PRETTY_BOY: "pretty_boy",
    GYMCEL: "gymcel",
    SLEEPLESS_DEMON: "sleepless_demon",
    FINAL_BOSS: "final_boss",
    NOT_FOUND: "face_not_found"
  }
};
