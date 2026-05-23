import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MogPeer } from '../utils/webrtc.js';

describe('MogPeer', () => {
  let mockSocket;
  let onRemoteStream;
  let onStateChange;

  beforeEach(() => {
    mockSocket = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };
    onRemoteStream = vi.fn();
    onStateChange = vi.fn();

    // Mock RTCPeerConnection
    global.RTCPeerConnection = vi.fn().mockImplementation(() => ({
      createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
      createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-sdp' }),
      setLocalDescription: vi.fn().mockResolvedValue(),
      setRemoteDescription: vi.fn().mockResolvedValue(),
      addIceCandidate: vi.fn().mockResolvedValue(),
      addTrack: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
    }));
  });

  it('initializes as initiator correctly', () => {
    const peer = new MogPeer(mockSocket, 'room123', true, onRemoteStream, onStateChange);
    expect(peer.isInitiator).toBe(true);
    expect(peer.roomId).toBe('room123');
    // It should have registered socket listeners
    expect(mockSocket.on).toHaveBeenCalledWith('signal', expect.any(Function));
  });

  it('sets local stream correctly', () => {
    const peer = new MogPeer(mockSocket, 'room123', true, onRemoteStream, onStateChange);
    const mockTrack = {};
    const mockStream = {
      getTracks: () => [mockTrack],
    };
    
    peer.setLocalStream(mockStream);
    expect(peer.peer.addTrack).toHaveBeenCalledWith(mockTrack, mockStream);
  });
});
