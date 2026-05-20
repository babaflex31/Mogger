// WebRTC helper for real-time video stream negotiation

export class MogPeer {
  constructor(socket, roomId, isInitiator, onRemoteStreamCallback, onConnectionStateChange) {
    this.socket = socket;
    this.roomId = roomId;
    this.isInitiator = isInitiator;
    this.onRemoteStream = onRemoteStreamCallback;
    this.onStateChange = onConnectionStateChange;
    this.peerConnection = null;
    this.localStream = null;
    this.queuedCandidates = [];

    // Standard public STUN servers for local testing and P2P hole punching
    this.iceConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };

    this.init();
  }

  init() {
    console.log(`[MOG-RTC] Initializing Peer. Initiator: ${this.isInitiator}`);
    
    this.peerConnection = new RTCPeerConnection(this.iceConfig);

    // Track remote connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log(`[MOG-RTC] Connection state: ${this.peerConnection.connectionState}`);
      if (this.onStateChange) {
        this.onStateChange(this.peerConnection.connectionState);
      }
    };

    // When an ICE candidate is generated, send it to the other peer via Socket.IO
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('signal', {
          roomId: this.roomId,
          signal: { candidate: event.candidate }
        });
      }
    };

    // When remote track (video/audio) arrives, trigger callback
    this.peerConnection.ontrack = (event) => {
      console.log("[MOG-RTC] Remote track received");
      if (event.streams && event.streams[0]) {
        this.onRemoteStream(event.streams[0]);
      }
    };

    // Listen to signaling signals from server
    this.signalHandler = ({ signal, sender }) => {
      if (sender === this.socket.id) return; // Ignore own signaling

      if (signal.sdp) {
        this.handleSdp(signal.sdp);
      } else if (signal.candidate) {
        this.handleIceCandidate(signal.candidate);
      }
    };

    this.socket.on('signal', this.signalHandler);
  }

  async setLocalStream(stream) {
    this.localStream = stream;
    // Add all tracks from local camera to the peer connection
    stream.getTracks().forEach((track) => {
      this.peerConnection.addTrack(track, stream);
    });
    console.log("[MOG-RTC] Local stream tracks added to connection");

    // Initiator starts negotiation by creating offer
    if (this.isInitiator) {
      await this.createOffer();
    }
  }

  async createOffer() {
    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      console.log("[MOG-RTC] Created local offer");
      
      this.socket.emit('signal', {
        roomId: this.roomId,
        signal: { sdp: offer }
      });
    } catch (e) {
      console.error("[MOG-RTC] Error creating offer:", e);
    }
  }

  async handleSdp(sdp) {
    try {
      if (sdp.type === 'offer') {
        console.log("[MOG-RTC] Received offer, set remote desc");
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
        
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        console.log("[MOG-RTC] Created local answer");
        
        this.socket.emit('signal', {
          roomId: this.roomId,
          signal: { sdp: answer }
        });
        await this.processQueuedCandidates();
      } else if (sdp.type === 'answer') {
        console.log("[MOG-RTC] Received answer, set remote desc");
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
        await this.processQueuedCandidates();
      }
    } catch (e) {
      console.error("[MOG-RTC] Error handling SDP:", e);
    }
  }

  async handleIceCandidate(candidate) {
    try {
      if (this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        this.queuedCandidates.push(candidate);
        console.log("[MOG-RTC] Queued incoming ICE candidate (remote description not set yet)");
      }
    } catch (e) {
      console.error("[MOG-RTC] Error adding ICE candidate:", e);
    }
  }

  async processQueuedCandidates() {
    if (this.queuedCandidates.length === 0) return;
    console.log(`[MOG-RTC] Processing ${this.queuedCandidates.length} queued ICE candidates`);
    for (const candidate of this.queuedCandidates) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("[MOG-RTC] Error adding queued ICE candidate:", e);
      }
    }
    this.queuedCandidates = [];
  }

  close() {
    console.log("[MOG-RTC] Closing WebRTC connection");
    this.socket.off('signal', this.signalHandler);
    if (this.peerConnection) {
      this.peerConnection.close();
    }
  }
}

