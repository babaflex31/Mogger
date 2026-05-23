// src/__tests__/faceMeshDetector.test.js
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { MogFaceDetector } from '../utils/faceMeshDetector.js';

// Mock canvas and video elements
function createMockCanvas() {
  const ctx = {
    clearRect: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    font: '',
    fillText: vi.fn(),
    shadowColor: '',
    shadowBlur: 0
  };
  const canvas = {
    width: 640,
    height: 480,
    getContext: () => ctx
  };
  return { canvas, ctx };
}

function createMockVideo() {
  return { readyState: 4 };
}

describe('MogFaceDetector core calculations', () => {
  let detector;
  beforeAll(() => {
    const { canvas } = createMockCanvas();
    const video = createMockVideo();
    // Mock onResults callback
    const onResults = vi.fn();
    detector = new MogFaceDetector(video, canvas, onResults);
    // Mock FaceMesh to avoid external dependency
    detector.faceMesh = {
      send: vi.fn().mockResolvedValue(undefined)
    };
  });

  it('calculateFinalScore returns all required metric keys', () => {
    const scores = detector.calculateFinalScore(
      80, // symmetry
      85, // jawline
      2,  // tilt (degrees)
      70, // mewing
      90, // hunterGaze
      75, // browCompactness
      80, // midfaceRatio
      70, // lipRatio
      85  // facialThirds
    );
    const expectedKeys = [
      'symmetry', 'jawline', 'canthalTilt', 'mewing', 'hunterGaze',
      'browCompactness', 'midfaceRatio', 'lipRatio', 'facialThirds',
      'finalScore'
    ];
    expect(Object.keys(scores)).toEqual(expect.arrayContaining(expectedKeys));
    // Verify numeric ranges (0-100)
    expectedKeys.forEach((k) => {
      expect(scores[k]).toBeGreaterThanOrEqual(0);
      expect(scores[k]).toBeLessThanOrEqual(100);
    });
  });

  it('drawLandmarks does not throw when called with mock data', () => {
    const mockLandmarks = Array.from({ length: 468 }, (_, i) => ({ x: i / 500, y: i / 500 }));
    // Provide dummy scores to trigger text rendering path
    const dummyScores = detector.calculateFinalScore(80,85,2,70,90,75,80,70,85);
    expect(() => detector.drawLandmarks(mockLandmarks, dummyScores)).not.toThrow();
  });
});
