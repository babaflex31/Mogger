// MediaPipe FaceMesh wrapper and Looksmaxxing Score Engine

class KalmanFilter {
  constructor(q = 0.001, r = 0.1) {
    this.q = q;
    this.r = r;
    this.x = 0;
    this.p = 1;
    this.k = 0;
  }
  update(measurement) {
    this.p = this.p + this.q;
    this.k = this.p / (this.p + this.r);
    this.x = this.x + this.k * (measurement - this.x);
    this.p = (1 - this.k) * this.p;
    return this.x;
  }
}

export class MogFaceDetector {
  constructor(videoElement, canvasElement, onResultsCallback) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.onResults = onResultsCallback;
    this.faceMesh = null;
    this.active = false;
    this.isMocking = false;
    this.loopTimeout = null;
    this.animationFrameId = null;
    this.consecutiveErrors = 0;

    this.scoreFilter = new KalmanFilter();
  }

  init() {
    if (window.FaceMesh) {
      try {
        this.faceMesh = new window.FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        this.faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6
        });

        this.faceMesh.onResults((results) => this.handleFaceMeshResults(results));
        console.log("[MOG-AI] MediaPipe FaceMesh initialized successfully");
      } catch (err) {
        console.warn("[MOG-AI] MediaPipe initialization failed. Falling back to Mock AI.", err);
        this.isMocking = true;
      }
    } else {
      console.warn("[MOG-AI] MediaPipe CDN not loaded. Falling back to Mock AI.");
      this.isMocking = true;
    }
  }

  start() {
    this.active = true;
    if (this.isMocking) {
      this.startMockTracking();
    } else {
      this.startCaptureLoop();
    }
  }

  stop() {
    this.active = false;
    if (this.loopTimeout) {
      clearTimeout(this.loopTimeout);
      this.loopTimeout = null;
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.mockInterval) {
      clearInterval(this.mockInterval);
      this.mockInterval = null;
    }
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  startCaptureLoop() {
    console.log("[MOG-AI] Starting custom frame capture loop...");
    
    const processFrame = async () => {
      if (!this.active) return;

      if (this.video && this.video.readyState >= 2) {
        try {
          await this.faceMesh.send({ image: this.video });
          this.consecutiveErrors = 0;
        } catch (e) {
          console.error("[MOG-AI] FaceMesh frame processing error:", e);
          this.consecutiveErrors++;
          
          if (this.consecutiveErrors >= 3) {
            console.warn("[MOG-AI] Too many consecutive AI errors. Dynamically fallback to mock AI.");
            this.isMocking = true;
            this.stop();
            this.start();
            return;
          }
        }
      }

      this.loopTimeout = setTimeout(() => {
        if (this.active && !this.isMocking) {
          this.animationFrameId = requestAnimationFrame(processFrame);
        }
      }, 200);
    };

    this.animationFrameId = requestAnimationFrame(processFrame);
  }

  startMockTracking() {
    console.log("[MOG-AI] Starting simulated tracking...");
    let ticks = 0;
    this.mockInterval = setInterval(() => {
      if (!this.active) return;
      ticks++;

      const baseSymmetry = 80 + Math.sin(ticks * 0.1) * 3 + Math.random() * 2;
      const baseJawline = 75 + Math.cos(ticks * 0.08) * 4 + Math.random() * 2;
      const baseTilt = 1.5 + Math.sin(ticks * 0.12) * 0.5 + Math.random() * 0.2;
      const baseMewing = 70 + (Math.sin(ticks * 0.05) > 0.5 ? 15 : 0) + Math.random() * 3;
      const baseHunter = 82 + Math.sin(ticks * 0.15) * 4 + Math.random() * 2;
      const baseBrow = 78 + Math.cos(ticks * 0.11) * 3 + Math.random() * 2;
      const baseMidface = 80 + Math.sin(ticks * 0.09) * 4 + Math.random() * 2;
      const baseLip = 85 + Math.cos(ticks * 0.07) * 2 + Math.random() * 1;
      const baseThirds = 88 + Math.sin(ticks * 0.06) * 3 + Math.random() * 2;

      const scores = this.calculateFinalScore(
        baseSymmetry, baseJawline, baseTilt, baseMewing,
        baseHunter, baseBrow, baseMidface, baseLip, baseThirds
      );
      const combatType = this.determineCombatType(scores);
      
      const fraudAlerts = {
        filterAbuse: false,
        angleAbuse: false,
        virtualCamera: false,
        disqualified: false
      };

      this.drawMockLandmarks();
      this.onResults({
        scores,
        combatType,
        fraudAlerts,
        isSimulated: true
      });
    }, 200);
  }

  handleFaceMeshResults(results) {
    if (!this.active) return;

    if (this.canvas.width !== this.canvas.clientWidth || this.canvas.height !== this.canvas.clientHeight) {
      this.canvas.width = this.canvas.clientWidth;
      this.canvas.height = this.canvas.clientHeight;
    }
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      this.onResults({
        scores: { 
          symmetry: 0, jawline: 0, canthalTilt: 0, mewing: 0, 
          hunterGaze: 0, browCompactness: 0, midfaceRatio: 0, 
          lipRatio: 0, facialThirds: 0, finalScore: 0 
        },
        combatType: "NO FACE DETECTED",
        fraudAlerts: { disqualified: false },
        isSimulated: false
      });
      return;
    }

    const landmarks = results.multiFaceLandmarks[0];

    // Draw mesh points and high-tech overlays
    this.drawLandmarks(landmarks);

    // Calculate advanced metrics
    const symmetry = this.calcSymmetry(landmarks);
    const jawline = this.calcJawline(landmarks);
    const canthalTilt = this.calcCanthalTilt(landmarks);
    const mewing = this.calcMewing(landmarks);
    const hunterGaze = this.calcHunterGaze(landmarks);
    const browCompactness = this.calcBrowCompactness(landmarks);
    const midfaceRatio = this.calcMidfaceRatio(landmarks);
    const lipRatio = this.calcLipRatio(landmarks);
    const facialThirds = this.calcFacialThirds(landmarks);

    const scores = this.calculateFinalScore(
      symmetry, jawline, canthalTilt, mewing, 
      hunterGaze, browCompactness, midfaceRatio, lipRatio, facialThirds
    );
    const combatType = this.determineCombatType(scores);

    const fraudAlerts = this.detectFraud(landmarks, results);

    this.onResults({
      scores,
      combatType,
      fraudAlerts,
      landmarks,
      isSimulated: false
    });
  }

  dist(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  drawLandmarks(landmarks) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    this.ctx.fillStyle = "rgba(255, 0, 60, 0.5)"; // Neon Red mesh points
    this.ctx.strokeStyle = "rgba(255, 0, 60, 0.15)";
    this.ctx.lineWidth = 0.5;

    // Draw mesh wireframe
    for (let i = 0; i < landmarks.length; i += 6) {
      const lm = landmarks[i];
      const x = lm.x * width;
      const y = lm.y * height;
      
      this.ctx.beginPath();
      this.ctx.arc(x, y, 1.0, 0, 2 * Math.PI);
      this.ctx.fill();
    }

    // Highlight Jawline (Cyan)
    const jawIndices = [172, 150, 176, 152, 400, 379, 397];
    this.ctx.strokeStyle = "rgba(0, 240, 255, 0.8)";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    jawIndices.forEach((idx, i) => {
      const lm = landmarks[idx];
      const x = lm.x * width;
      const y = lm.y * height;
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    });
    this.ctx.stroke();

    // Eye Centers & Tilt lines (Pink)
    const leftEye = [landmarks[33], landmarks[133]];
    const rightEye = [landmarks[362], landmarks[263]];
    this.ctx.strokeStyle = "#ff007f";
    this.ctx.lineWidth = 1.5;
    [leftEye, rightEye].forEach(eye => {
      this.ctx.beginPath();
      this.ctx.moveTo(eye[0].x * width, eye[0].y * height);
      this.ctx.lineTo(eye[1].x * width, eye[1].y * height);
      this.ctx.stroke();
    });

    // High-tech Brows to eye center lines (Brow Compactness)
    const leftEyeCenter = {
      x: (landmarks[33].x + landmarks[133].x) / 2,
      y: (landmarks[33].y + landmarks[133].y) / 2
    };
    const rightEyeCenter = {
      x: (landmarks[263].x + landmarks[362].x) / 2,
      y: (landmarks[263].y + landmarks[362].y) / 2
    };
    this.ctx.strokeStyle = "rgba(255, 230, 0, 0.4)"; // Yellow
    this.ctx.beginPath();
    this.ctx.moveTo(landmarks[105].x * width, landmarks[105].y * height);
    this.ctx.lineTo(leftEyeCenter.x * width, leftEyeCenter.y * height);
    this.ctx.moveTo(landmarks[334].x * width, landmarks[334].y * height);
    this.ctx.lineTo(rightEyeCenter.x * width, rightEyeCenter.y * height);
    this.ctx.stroke();

    // Midface Ratio Line (Pupils midpoint to mouth center)
    const midpupil = {
      x: (leftEyeCenter.x + rightEyeCenter.x) / 2,
      y: (leftEyeCenter.y + rightEyeCenter.y) / 2
    };
    const mouthCenter = {
      x: (landmarks[61].x + landmarks[291].x) / 2,
      y: (landmarks[61].y + landmarks[291].y) / 2
    };
    this.ctx.strokeStyle = "rgba(0, 255, 100, 0.4)"; // Green
    this.ctx.beginPath();
    this.ctx.moveTo(midpupil.x * width, midpupil.y * height);
    this.ctx.lineTo(mouthCenter.x * width, mouthCenter.y * height);
    this.ctx.stroke();
  }

  drawMockLandmarks() {
    if (this.canvas.width !== this.canvas.clientWidth || this.canvas.height !== this.canvas.clientHeight) {
      this.canvas.width = this.canvas.clientWidth;
      this.canvas.height = this.canvas.clientHeight;
    }

    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.clearRect(0, 0, width, height);

    this.ctx.fillStyle = "rgba(255, 0, 60, 0.4)";
    this.ctx.font = "10px monospace";
    this.ctx.fillText("AI ENGINE: RUNNING ADVANCED SIMULATION", 10, 20);

    const centerX = width / 2;
    const centerY = height / 2;

    this.ctx.strokeStyle = "rgba(255, 0, 60, 0.15)";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, 80, 0, 2 * Math.PI);
    this.ctx.stroke();

    const time = Date.now() * 0.005;
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const radius = 80 + Math.sin(time + i) * 5;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      this.ctx.beginPath();
      this.ctx.arc(x, y, 1.5, 0, 2 * Math.PI);
      this.ctx.fill();
    }
  }

  // Looksmaxxing Calculators
  calcSymmetry(landmarks) {
    const nose = landmarks[168];
    const leftCheek = landmarks[234];
    const rightCheek = landmarks[454];

    const distL = this.dist(nose, leftCheek);
    const distR = this.dist(nose, rightCheek);

    const ratio = Math.min(distL, distR) / (Math.max(distL, distR) || 1);
    return Math.round(ratio * 100);
  }

  calcJawline(landmarks) {
    const jawLeft = landmarks[172];
    const jawRight = landmarks[397];
    const forehead = landmarks[10];
    const chin = landmarks[152];

    const jawWidth = this.dist(jawLeft, jawRight);
    const faceHeight = this.dist(forehead, chin);

    const score = (jawWidth / (faceHeight || 1)) * 110;
    return Math.min(100, Math.max(40, Math.round(score)));
  }

  calcCanthalTilt(landmarks) {
    const outer = landmarks[33];
    const inner = landmarks[133];
    const radians = Math.atan2(inner.y - outer.y, outer.x - inner.x);
    const degrees = radians * (180 / Math.PI);
    return Math.round(degrees * 10) / 10;
  }

  calcMewing(landmarks) {
    const lipBottom = landmarks[17];
    const chin = landmarks[152];
    const forehead = landmarks[10];

    const chinHeight = this.dist(lipBottom, chin);
    const faceHeight = this.dist(forehead, chin);

    const ratio = chinHeight / (faceHeight || 1);
    const mewingScore = 100 - Math.min(100, Math.max(0, Math.round((ratio - 0.05) * 500)));
    return mewingScore;
  }

  calcHunterGaze(landmarks) {
    const leftWidth = this.dist(landmarks[33], landmarks[133]);
    const leftHeight = this.dist(landmarks[159], landmarks[145]);
    const leftEAR = leftHeight / (leftWidth || 1);

    const rightWidth = this.dist(landmarks[263], landmarks[362]);
    const rightHeight = this.dist(landmarks[386], landmarks[374]);
    const rightEAR = rightHeight / (rightWidth || 1);

    const avgEAR = (leftEAR + rightEAR) / 2;
    let score = 100 - ((avgEAR - 0.15) / 0.2) * 70;
    return Math.round(Math.max(30, Math.min(100, score)));
  }

  calcBrowCompactness(landmarks) {
    const leftWidth = this.dist(landmarks[33], landmarks[133]);
    const leftEyeCenter = {
      x: (landmarks[33].x + landmarks[133].x) / 2,
      y: (landmarks[33].y + landmarks[133].y) / 2
    };
    const leftBrowDist = this.dist(landmarks[105], leftEyeCenter) / (leftWidth || 1);

    const rightWidth = this.dist(landmarks[263], landmarks[362]);
    const rightEyeCenter = {
      x: (landmarks[263].x + landmarks[362].x) / 2,
      y: (landmarks[263].y + landmarks[362].y) / 2
    };
    const rightBrowDist = this.dist(landmarks[334], rightEyeCenter) / (rightWidth || 1);

    const avgBrowRatio = (leftBrowDist + rightBrowDist) / 2;
    let score = 100 - ((avgBrowRatio - 0.5) / 0.5) * 70;
    return Math.round(Math.max(30, Math.min(100, score)));
  }

  calcMidfaceRatio(landmarks) {
    const leftEyeCenter = {
      x: (landmarks[33].x + landmarks[133].x) / 2,
      y: (landmarks[33].y + landmarks[133].y) / 2
    };
    const rightEyeCenter = {
      x: (landmarks[263].x + landmarks[362].x) / 2,
      y: (landmarks[263].y + landmarks[362].y) / 2
    };
    
    const pd = this.dist(leftEyeCenter, rightEyeCenter);
    
    const mouthCenter = {
      x: (landmarks[61].x + landmarks[291].x) / 2,
      y: (landmarks[61].y + landmarks[291].y) / 2
    };
    const midpupilLine = {
      x: (leftEyeCenter.x + rightEyeCenter.x) / 2,
      y: (leftEyeCenter.y + rightEyeCenter.y) / 2
    };
    const midfaceHeight = this.dist(midpupilLine, mouthCenter);
    
    const ratio = pd / (midfaceHeight || 1);
    let score = 40 + ((ratio - 0.85) / 0.3) * 60;
    return Math.round(Math.max(30, Math.min(100, score)));
  }

  calcLipRatio(landmarks) {
    const mouthWidth = this.dist(landmarks[61], landmarks[291]);
    const noseWidth = this.dist(landmarks[129], landmarks[358]);
    const lipRatio = mouthWidth / (noseWidth || 1);
    
    const diff = Math.abs(lipRatio - 1.618);
    let score = 100 - (diff / 0.6) * 60;
    return Math.round(Math.max(30, Math.min(100, score)));
  }

  calcFacialThirds(landmarks) {
    const upperH = this.dist(landmarks[10], landmarks[168]);
    const middleH = this.dist(landmarks[168], landmarks[2]);
    const lowerH = this.dist(landmarks[2], landmarks[152]);
    const totalH = upperH + middleH + lowerH;

    const upperPct = upperH / (totalH || 1);
    const middlePct = middleH / (totalH || 1);
    const lowerPct = lowerH / (totalH || 1);

    const deviation = Math.abs(upperPct - 0.333) + Math.abs(middlePct - 0.333) + Math.abs(lowerPct - 0.333);
    let score = 100 - (deviation / 0.15) * 60;
    return Math.round(Math.max(30, Math.min(100, score)));
  }

  calculateFinalScore(symmetry, jawline, tilt, mewing, hunterGaze, browCompactness, midfaceRatio, lipRatio, facialThirds) {
    const tiltScore = Math.min(100, Math.max(20, Math.round(((tilt + 4) / 10) * 100)));

    const rawFinal = 
      (symmetry * 0.15) + 
      (jawline * 0.15) + 
      (tiltScore * 0.15) + 
      (mewing * 0.10) + 
      (hunterGaze * 0.15) + 
      (browCompactness * 0.10) + 
      (midfaceRatio * 0.10) + 
      (lipRatio * 0.05) + 
      (facialThirds * 0.05);

    const smoothedFinal = this.scoreFilter.update(rawFinal);

    return {
      symmetry: Math.round(symmetry),
      jawline: Math.round(jawline),
      canthalTilt: tilt,
      mewing: Math.round(mewing),
      hunterGaze: Math.round(hunterGaze),
      browCompactness: Math.round(browCompactness),
      midfaceRatio: Math.round(midfaceRatio),
      lipRatio: Math.round(lipRatio),
      facialThirds: Math.round(facialThirds),
      finalScore: Math.round(smoothedFinal)
    };
  }

  determineCombatType(scores) {
    const { symmetry, jawline, canthalTilt, hunterGaze, finalScore } = scores;

    if (finalScore >= 92) return "NORDIC MOGGER";
    if (jawline >= 85 && hunterGaze >= 88 && canthalTilt >= 2) return "PREDATOR TYPE";
    if (finalScore >= 80 && symmetry >= 85) return "PRETTY BOY";
    if (jawline >= 80) return "GYMCEL";
    if (canthalTilt < 0) return "SLEEP DEPRIVED DEMON";
    
    return "FINAL BOSS IN TRAINING";
  }

  detectFraud(landmarks, results) {
    const nose = landmarks[1];
    const forehead = landmarks[10];
    const chin = landmarks[152];

    const upperHeight = this.dist(forehead, nose);
    const lowerHeight = this.dist(nose, chin);
    const verticalRatio = upperHeight / (lowerHeight || 1);
    
    const angleAbuse = verticalRatio < 0.6 || verticalRatio > 1.8;
    const filterAbuse = false;
    const virtualCamera = false;

    return {
      filterAbuse,
      angleAbuse,
      virtualCamera,
      disqualified: angleAbuse
    };
  }
}

