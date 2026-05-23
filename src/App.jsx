import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { io } from 'socket.io-client';
import { CONFIG } from './config.js';
import { 
  Swords, 
  User, 
  Terminal, 
  RotateCcw, 
  Play, 
  Share2, 
  Crown, 
  Flame, 
  Volume2, 
  VolumeX,
  Smartphone,
  Settings as SettingsIcon,
  Crosshair as CrosshairIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import CameraStream from './components/CameraStream';
import TechnicalPanel from './components/TechnicalPanel';
import Settings from './components/Settings';
import { MogFaceDetector } from './utils/faceMeshDetector';
import { MogPeer } from './utils/webrtc';

// Audio Synthesizer using Web Audio API for custom cyberpunk phonk sound effects
class MogSynth {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playTick() {
    if (this.muted) return;
    this.init();
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playFight() {
    if (this.muted) return;
    this.init();
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.3);
    
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  playBassDrop() {
    if (this.muted) return;
    this.init();

    // Deep Phonk Kick / Sub Bass drop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(25, this.ctx.currentTime + 1.2);
    
    gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.2);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 1.2);

    // Distortion Overlay for Phonk Glitch Effect
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(70, this.ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.6);
    gain2.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start();
    osc2.stop(this.ctx.currentTime + 0.6);
  }
}

const synth = new MogSynth();

export default function App() {
  const { t } = useTranslation();

  // Replace hardcoded UI strings with translation keys
  const arenaTitle = t('enter_arena');
  const arenaSubtitle = t('arena_subtitle');
  const findMatchBtn = t('find_match');
  const soloPracticeBtn = t('solo_practice_arena');
  const customMatchBtn = t('custom_match');
  const tournamentBtn = t('tournament');
  const cancelQueueBtn = t('cancel_queue');
  const matchmakingActive = t('matchmaking_active');
  const searchingOpponent = t('searching_opponent');
  const queueTimeLabel = t('queue_time');
  const eloRangeLabel = t('elo_range');

  // Navigation & States
  const [screen, setScreen] = useState('LOBBY'); // LOBBY, MATCHMAKING, BATTLE, RESULT
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('mog_username') || `Mogger_${Math.floor(1000 + Math.random() * 9000)}`;
  });
  const [elo, setElo] = useState(() => {
    return parseInt(localStorage.getItem('mog_elo') || '1000', 10);
  });
  const [rank, setRank] = useState('GYMCEL');
  const [streak, setStreak] = useState(0);

  // Networking States
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [playerRole, setPlayerRole] = useState(null); // 'player1' or 'player2'
  const [opponentInfo, setOpponentInfo] = useState(null);
  const [peerState, setPeerState] = useState('new'); // connecting, connected, disconnected
const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Media Streams & AI Ref
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  // Live scoring data
  const [localScores, setLocalScores] = useState({ 
    symmetry: 0, jawline: 0, canthalTilt: 0, mewing: 0, 
    hunterGaze: 0, browCompactness: 0, midfaceRatio: 0, 
    lipRatio: 0, facialThirds: 0, finalScore: 0 
  });
  const [localCombatType, setLocalCombatType] = useState('FINAL BOSS IN TRAINING');

  // Custom Room & Tournament States
  const [customRoom, setCustomRoom] = useState(null);
  const [customCodeInput, setCustomCodeInput] = useState('');
  const [customError, setCustomError] = useState('');
  const [matchDuration, setMatchDuration] = useState(CONFIG.DEFAULT_MATCH_DURATION);
  
  const [tournament, setTournament] = useState(null);
  const [tCodeInput, setTCodeInput] = useState('');
  const [tError, setTError] = useState('');
  const [localFraud, setLocalFraud] = useState({ disqualified: false });

  // Settle Score Data for Result Screen
  const [battleResult, setBattleResult] = useState(null);

  // UI States for Battle Phase
  const [battlePhase, setBattlePhase] = useState('WAITING_PEERS'); // WAITING_PEERS, COUNTDOWN, FIGHT, RESOLVING
  const [countdownText, setCountdownText] = useState('3');
  const [fightTimer, setFightTimer] = useState(CONFIG.DEFAULT_MATCH_DURATION); // battle duration

  // HTML Element Refs and Callback States for reliable DOM binding
  const [localVideoElement, setLocalVideoElement] = useState(null);
  const [localCanvasElement, setLocalCanvasElement] = useState(null);

  const localVideoRef = useCallback((node) => {
    setLocalVideoElement(node);
  }, []);

  const localCanvasRef = useCallback((node) => {
    setLocalCanvasElement(node);
  }, []);

  const remoteCanvasRef = useRef(null);
  const detectorRef = useRef(null);
  const peerRef = useRef(null);

  // Refs for preventing stale closures inside socket event listeners
  const socketRef = useRef(null);
  const roomIdRef = useRef(null);
  const playerRoleRef = useRef(null);
  const localScoresRef = useRef(localScores);
  const localCombatTypeRef = useRef(localCombatType);
  const localFraudRef = useRef(localFraud);
  const localStreamRef = useRef(localStream);
  const matchDurationRef = useRef(matchDuration);

  useEffect(() => { socketRef.current = socket; }, [socket]);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);
  useEffect(() => { playerRoleRef.current = playerRole; }, [playerRole]);
  useEffect(() => { localScoresRef.current = localScores; }, [localScores]);
  useEffect(() => { localCombatTypeRef.current = localCombatType; }, [localCombatType]);
  useEffect(() => { localFraudRef.current = localFraud; }, [localFraud]);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
  useEffect(() => { matchDurationRef.current = matchDuration; }, [matchDuration]);

  // Sound Synth Mute Toggle
  const toggleMute = () => {
    synth.muted = !synth.muted;
    setIsAudioMuted(synth.muted);
  };

  // Determine Rank Tier based on ELO
  useEffect(() => {
    if (elo >= 1300) setRank('NORDIC MOGGER');
    else if (elo >= 1150) setRank('PREDATOR TYPE');
    else if (elo >= 1050) setRank('PRETTY BOY');
    else setRank('GYMCEL');
    localStorage.setItem('mog_elo', elo.toString());
  }, [elo]);

  // Connect to Socket server (Exactly once on mount!)
  useEffect(() => {
    const newSocket = io(window.location.hostname === 'localhost' ? 'http://localhost:3001' : '/');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log("[MOG-CLIENT] Connected to signaling gateway");
    });

    newSocket.on('match_found', ({ roomId, role, opponent, customDuration }) => {
      console.log(`[MOG-CLIENT] Match found! Room: ${roomId}, Role: ${role}`);
      setRoomId(roomId);
      setPlayerRole(role);
      setOpponentInfo(opponent);
      const dur = customDuration || 10;
      setMatchDuration(dur);
      matchDurationRef.current = dur;
      setScreen('BATTLE');
      setBattlePhase('WAITING_PEERS');
      newSocket.emit('join_room', { roomId });

      // Initialize WebRTC Peer connection immediately so video is ready before countdown
      const isInitiator = role === 'player1';
      console.log(`[MOG-CLIENT] Initializing WebRTC. Initiator: ${isInitiator}, Room: ${roomId}`);
      
      if (peerRef.current) {
        peerRef.current.close();
      }

      peerRef.current = new MogPeer(
        newSocket,
        roomId,
        isInitiator,
        (remoteMediaStream) => {
          console.log("[MOG-CLIENT] Attaching remote stream");
          setRemoteStream(remoteMediaStream);
        },
        (connectionState) => {
          setPeerState(connectionState);
          if (connectionState === 'connected') {
            newSocket.emit('peer_connected', { roomId });
          }
        }
      );

      if (localStreamRef.current) {
        peerRef.current.setLocalStream(localStreamRef.current);
      }
    });

    newSocket.on('battle_countdown_start', ({ customDuration }) => {
      setBattlePhase('COUNTDOWN');
      const dur = customDuration || 10;
      setMatchDuration(dur);
      matchDurationRef.current = dur;
      runCountdown();
    });

    newSocket.on('battle_start', () => {
      setBattlePhase('FIGHT');
      startBattleTimer(matchDurationRef.current);
    });

    newSocket.on('battle_result', (result) => {
      setBattleResult(result);
      setBattlePhase('RESOLVING');
      
      // Update ELO locally for the user using the ref to avoid stale closures
      const selfResult = roleToSelf(result, playerRoleRef.current);
      if (selfResult) {
        setElo(prev => prev + selfResult.eloChange);
        if (selfResult.eloChange > 0) {
          setStreak(prev => prev + 1);
        } else {
          setStreak(0);
        }
      }

      setTimeout(() => {
        setScreen('RESULT');
        synth.playBassDrop();
      }, 1500);
    });

    newSocket.on('opponent_disconnected', () => {
      console.warn("Opponent disconnected during battle");
      alert("OPPONENT DISCONNECTED. YOU WIN BY DEFAULT!");
      cleanupBattle();
      setScreen('LOBBY');
    });

    // Custom Room Event Listeners
    newSocket.on('custom_room_created', (roomData) => {
      setCustomRoom(roomData);
      setCustomError('');
      setScreen('CUSTOM_LOBBY');
    });

    newSocket.on('custom_room_updated', (roomData) => {
      setCustomRoom(roomData);
      setCustomError('');
      setScreen(prev => prev === 'CUSTOM_MENU' ? 'CUSTOM_LOBBY' : prev);
    });

    newSocket.on('custom_room_error', ({ message }) => {
      setCustomError(message);
      alert(message);
    });

    // Tournament Event Listeners
    newSocket.on('tournament_created', (tData) => {
      setTournament(tData);
      setTError('');
      setScreen('TOURNAMENT_LOBBY');
    });

    newSocket.on('tournament_updated', (tData) => {
      setTournament(tData);
      setTError('');
      setScreen(prev => prev === 'TOURNAMENT_MENU' ? 'TOURNAMENT_LOBBY' : prev);
    });

    newSocket.on('tournament_error', ({ message }) => {
      setTError(message);
      alert(message);
    });

    newSocket.on('tournament_match_ready', ({ roomId, role, opponent }) => {
      console.log(`[MOG-CLIENT] Tournament match ready! Room ${roomId}`);
      // Teardown previous peer connection to avoid stale channels
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }
      setRemoteStream(null);
      setPeerState('new');

      setRoomId(roomId);
      setPlayerRole(role);
      setOpponentInfo(opponent);
      setScreen('BATTLE');
      setBattlePhase('WAITING_PEERS');
      newSocket.emit('join_room', { roomId });

      // Initialize WebRTC Peer connection immediately for tournament
      const isInitiator = role === 'player1';
      console.log(`[MOG-CLIENT] Initializing WebRTC for Tournament. Initiator: ${isInitiator}, Room: ${roomId}`);
      
      if (peerRef.current) {
        peerRef.current.close();
      }

      peerRef.current = new MogPeer(
        newSocket,
        roomId,
        isInitiator,
        (remoteMediaStream) => {
          console.log("[MOG-CLIENT] Attaching remote stream (Tournament)");
          setRemoteStream(remoteMediaStream);
        },
        (connectionState) => {
          setPeerState(connectionState);
          if (connectionState === 'connected') {
            newSocket.emit('peer_connected', { roomId });
          }
        }
      );

      if (localStreamRef.current) {
        peerRef.current.setLocalStream(localStreamRef.current);
      }
    });

    newSocket.on('tournament_finished', ({ champion }) => {
      alert(`TOURNAMENT COMPLETE!\n🏆 GRAND CHAMPION: ${champion.username}`);
      cleanupBattle();
    });

    return () => {
      newSocket.disconnect();
    };
  }, []); // Run only on mount!

  // Helper to extract self details from result object
  const roleToSelf = (result, role) => {
    if (!result) return null;
    return role === 'player1' ? result.player1 : result.player2;
  };

  const roleToOpponent = (result, role) => {
    if (!result) return null;
    return role === 'player1' ? result.player2 : result.player1;
  };

  // Capture Local WebCam Feed
  // Duplicate initLocalCamera removed; using enhanced version defined later.

  // Start matchmaking sequence
  const startMatchmaking = async () => {
    localStorage.setItem('mog_username', username);
    setScreen('MATCHMAKING');

    const stream = await initLocalCamera();
    if (!stream) {
      setScreen('LOBBY');
      return;
    }

    if (socketRef.current) {
      socketRef.current.emit('join_queue', { username, rank, elo });
    }
  };

  const cancelMatchmaking = () => {
    if (socketRef.current) {
      socketRef.current.emit('leave_queue');
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setScreen('LOBBY');
  };

  // Solo training functions
  const startTraining = async () => {
    localStorage.setItem('mog_username', username);
    setScreen('TRAINING');
    const stream = await initLocalCamera();
    if (!stream) {
      setScreen('LOBBY');
    }
  };

  const stopTraining = () => {
    if (detectorRef.current) {
      detectorRef.current.stop();
      detectorRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setScreen('LOBBY');
  };

  // Auto-acquire camera stream dynamically if missing in active assessment views
  useEffect(() => {
    if ((screen === 'BATTLE' || screen === 'TRAINING') && !localStream) {
      console.log(`[MOG-CLIENT] Screen is ${screen} but localStream is missing. Dynamically acquiring camera...`);
      initLocalCamera();
    }
  }, [screen, localStream]);

  // AI Detector initializer (Runs once we enter the BATTLE or TRAINING screen and stream is ready)
  useEffect(() => {
    if ((screen === 'BATTLE' || screen === 'TRAINING') && localStream && localVideoElement && localCanvasElement) {
      localVideoElement.srcObject = localStream;
      
      console.log(`[MOG-CLIENT] Starting local face analyzer for screen: ${screen}`);
      detectorRef.current = new MogFaceDetector(
        localVideoElement,
        localCanvasElement,
        (results) => {
          if (results.scores) {
            setLocalScores(results.scores);
            setLocalCombatType(results.combatType);
            setLocalFraud(results.fraudAlerts);
          }
        }
      );
      detectorRef.current.init();
      detectorRef.current.start();
    }

    return () => {
      if (detectorRef.current) {
        detectorRef.current.stop();
        detectorRef.current = null;
      }
    };
  }, [screen, localStream, localVideoElement, localCanvasElement]);

  // Sync Countdown Clock
  const runCountdown = () => {
    let tick = 3;
    setCountdownText('3');
    synth.playTick();

    const interval = setInterval(() => {
      tick--;
      if (tick > 0) {
        setCountdownText(tick.toString());
        synth.playTick();
      } else if (tick === 0) {
        setCountdownText('MOG!');
        synth.playFight();
        clearInterval(interval);
        
        if (socketRef.current) {
          socketRef.current.emit('ready_to_battle', { roomId: roomIdRef.current });
        }
      }
    }, 1000);
  };

  // Active Timer counting down the looksmaxxing battle
  const startBattleTimer = (duration = CONFIG.DEFAULT_MATCH_DURATION) => {
    setFightTimer(duration);
    const interval = setInterval(() => {
      setFightTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          
          const finalPayload = {
            roomId: roomIdRef.current,
            scores: (detectorRef.current && detectorRef.current.active && localScoresRef.current)
              ? localScoresRef.current
              : { 
                  symmetry: 78, 
                  jawline: 80, 
                  canthalTilt: 1.5, 
                  mewing: 85, 
                  hunterGaze: 82, 
                  browCompactness: 76, 
                  midfaceRatio: 80, 
                  lipRatio: 88, 
                  facialThirds: 90, 
                  finalScore: 81 
                },
            combatType: localCombatTypeRef.current,
            fraudAlerts: localFraudRef.current
          };
          if (socketRef.current) {
            socketRef.current.emit('submit_final_score', finalPayload);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Navigation & Action Helper Methods for Custom Rooms & Tournaments
  const enterCustomLobby = () => {
    setScreen('CUSTOM_MENU');
  };

  const enterTournamentLobby = () => {
    setScreen('TOURNAMENT_MENU');
  };

  const createCustomRoom = () => {
    if (!socket) return;
    localStorage.setItem('mog_username', username);
    socket.emit('create_custom_room', { username, rank, elo });
  };

  const joinCustomRoom = () => {
    if (!socket || !customCodeInput) return;
    localStorage.setItem('mog_username', username);
    socket.emit('join_custom_room', { code: customCodeInput, userData: { username, rank, elo } });
  };

  const updateCustomSettings = (duration) => {
    if (!socket || !customRoom) return;
    socket.emit('update_custom_settings', { code: customRoom.code, duration });
  };

  const startCustomBattle = async () => {
    if (!socket || !customRoom) return;
    const stream = await initLocalCamera();
    if (stream) {
      socket.emit('start_custom_battle', { code: customRoom.code });
    }
  };

  const createTournament = () => {
    if (!socket) return;
    localStorage.setItem('mog_username', username);
    socket.emit('create_tournament', { username, elo });
  };

  const joinTournament = () => {
    if (!socket || !tCodeInput) return;
    localStorage.setItem('mog_username', username);
    socket.emit('join_tournament', { code: tCodeInput, userData: { username, elo } });
  }
  // Initialize local camera with proper permission handling
  const initLocalCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCustomError(t('camera_not_supported', 'Camera API not supported in this browser.'));
      return null;
    }
    if (!window.isSecureContext) {
      setCustomError(t('camera_https_required', 'Camera access requires HTTPS or localhost.'));
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('[MOG-CLIENT] Camera init error:', err);
      setCustomError(t('camera_permission_denied', 'Camera permission denied or unavailable: ') + err.message);
      return null;
    }
  };;

  const startTournament = async () => {
    if (!socket || !tournament) return;
    const stream = await initLocalCamera();
    if (stream) {
      socket.emit('start_tournament', { code: tournament.code });
    }
  };

  const leaveLobbyAndReset = () => {
    cleanupBattle();
    setCustomRoom(null);
    setTournament(null);
    setCustomCodeInput('');
    setTCodeInput('');
    setCustomError('');
    setTError('');
    setMatchDuration(CONFIG.DEFAULT_MATCH_DURATION);
    setScreen('LOBBY');
  };

  const cleanupBattle = () => {
    if (detectorRef.current) {
      detectorRef.current.stop();
      detectorRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);
    setBattleResult(null);
    setRoomId(null);
    setPlayerRole(null);
  };

  const mogAgain = () => {
    cleanupBattle();
    setScreen('LOBBY');
  };

  return (
    <div className="min-h-screen bg-dark-900 text-white scanlines relative flex flex-col justify-between p-4 md:p-6 overflow-hidden select-none">
      
      {/* Background Matrix Red Grid */}
      <div className="absolute inset-0 matrix-bg pointer-events-none opacity-40 z-0" />

      {/* Cybernetic Glitch Header */}
      <header className="relative z-10 w-full flex justify-between items-center border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="bg-neon-red p-1.5 rounded text-black font-black">
            <Swords className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm md:text-lg font-black tracking-widest text-white flex items-center gap-2">
              MOG BATTLE <span className="text-[9px] px-1 py-0.5 border border-neon-red/50 text-neon-red rounded tracking-normal font-mono crt-flicker">v1.0.0-BETA</span>
            </h1>
            <p className="text-[9px] md:text-xs font-mono text-zinc-500 uppercase tracking-tighter">
              Realtime Looksmaxxing Matchmaking
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Streak Indicator */}
          {streak > 0 && (
            <div className="bg-orange-950/60 border border-orange-500/50 text-orange-500 px-2 py-1 rounded text-xs font-mono flex items-center gap-1 shadow-lg">
              <Flame className="w-3.5 h-3.5 fill-orange-500" />
              <span>STREAK: {streak}</span>
            </div>
          )}

          {/* Sound Synthesizer control */}
          <button 
            onClick={toggleMute}
            className="p-2 border border-zinc-800 hover:border-neon-red rounded text-zinc-400 hover:text-white transition-colors"
          >
            {isAudioMuted ? <VolumeX className="w-4 h-4 text-neon-red" /> : <Volume2 className="w-4 h-4 text-neon-cyan" />}
          </button>
          
          <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-neon-cyan/20 rounded-full transition-colors">
            <SettingsIcon className="w-5 h-5 text-neon-cyan" />
          </button>
        </div>
      </header>
      {/* Settings Modal */}
      <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      
      {/* Primary Screens */}
      <main className="relative z-10 w-full flex-grow flex items-center justify-center py-6">
        <AnimatePresence mode="wait">

          {/* 1. LOBBY SCREEN */}
          {screen === 'LOBBY' && (
            <motion.div 
              key="lobby"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full max-w-md bg-dark-800/90 border-2 border-zinc-800 rounded-lg p-6 flex flex-col gap-6 shadow-2xl relative"
            >
              {/* Corner Sci-Fi Decorators */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-neon-red" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-neon-red" />

              <div className="text-center">
                <h2 className="text-xl font-black text-white tracking-widest text-neon-glow flex justify-center items-center gap-2">
                  {arenaTitle}
                </h2>
                <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase">
                  {arenaSubtitle}
                </p>
              </div>

              {/* Username Form */}
              <div className="flex flex-col gap-2">
                <label className="font-mono text-xs text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-neon-cyan" />
                  Mogger Alias
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={15}
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                    className="w-full bg-dark-900 border border-zinc-800 focus:border-neon-red rounded px-3 py-2 text-sm font-mono text-white tracking-widest outline-none transition-colors"
                  />
                  <Terminal className="absolute right-3 top-2.5 w-4 h-4 text-zinc-600" />
                </div>
              </div>

              {/* Rank and Stats HUD card */}
              <div className="bg-black/90 p-3 rounded border border-zinc-800/80 flex justify-between items-center font-mono">
                <div>
                  <div className="text-[9px] text-zinc-500 uppercase">Current Tier</div>
                  <div className="text-neon-cyan text-sm font-black tracking-widest">{rank}</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] text-zinc-500 uppercase">Matchmaking rating</div>
                  <div className="text-white text-sm font-black">{elo} ELO</div>
                </div>
              </div>

              {/* Begin Matchmaking Button */}
              <button
                onClick={startMatchmaking}
                className="w-full bg-neon-red hover:bg-red-600 text-black font-black py-3 rounded tracking-widest font-display text-sm flex items-center justify-center gap-2 border border-neon-red hover:border-white transition-all shadow-[0_0_15px_rgba(255,0,60,0.3)]"
              >
                <Play className="w-4 h-4 fill-black" />
                {findMatchBtn}
              </button>

              {/* Solo Practice Arena Button */}
              <button
                onClick={startTraining}
                className="w-full bg-transparent hover:bg-neon-cyan/10 text-neon-cyan font-black py-3 rounded tracking-widest font-display text-sm flex items-center justify-center gap-2 border border-neon-cyan hover:border-white transition-all shadow-[0_0_15px_rgba(0,240,255,0.15)]"
              >
                <Smartphone className="w-4 h-4 text-neon-cyan" />
                {soloPracticeBtn}
              </button>

              {/* Secondary Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={enterCustomLobby}
                  className="bg-dark-900 border border-zinc-700 hover:border-neon-cyan text-zinc-300 hover:text-neon-cyan font-mono py-2.5 rounded text-xs tracking-widest flex items-center justify-center gap-2 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  {customMatchBtn}
                </button>
                <button
                  onClick={enterTournamentLobby}
                  className="bg-dark-900 border border-zinc-700 hover:border-yellow-400 text-zinc-300 hover:text-yellow-400 font-mono py-2.5 rounded text-xs tracking-widest flex items-center justify-center gap-2 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                  {tournamentBtn}
                </button>
              </div>

              <div className="text-center text-[9px] text-zinc-600 font-mono uppercase tracking-widest mt-2">
                * Camera permission required. Raw feed only.
              </div>
            </motion.div>
          )}

          {/* 2. MATCHMAKING SCREEN */}
          {screen === 'MATCHMAKING' && (
            <motion.div 
              key="matchmaking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-sm flex flex-col items-center gap-8 text-center"
            >
              <div className="relative w-24 h-24 flex items-center justify-center">
                {/* Circular pulse scanning ring */}
                <div className="absolute inset-0 rounded-full border border-neon-red/30 animate-ping" />
                <div className="absolute inset-2 rounded-full border border-neon-red/60 animate-pulse" />
                <div className="absolute inset-4 rounded-full border-2 border-neon-red flex items-center justify-center">
                  <Swords className="w-8 h-8 text-neon-red animate-bounce" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-black tracking-widest text-neon-glow glitch-text" data-text={matchmakingActive}>
                  {matchmakingActive}
                </h3>
                <p className="font-mono text-xs text-neon-cyan uppercase animate-pulse">
                  {searchingOpponent}
                </p>
              </div>

              <div className="w-full bg-dark-800 border border-zinc-800/80 p-3 rounded font-mono text-xs text-zinc-500 uppercase flex justify-between">
                <span>{queueTimeLabel}: ACTIVE</span>
                <span className="text-white">{eloRangeLabel}: +/- 150</span>
              </div>

              <button
                onClick={cancelMatchmaking}
                className="bg-zinc-900 border border-zinc-800 hover:border-neon-red text-zinc-400 hover:text-white px-6 py-2 rounded text-xs font-mono tracking-widest uppercase transition-colors"
              >
                {cancelQueueBtn}
              </button>
            </motion.div>
          )}

          {/* CUSTOM_MENU SCREEN */}
          {screen === 'CUSTOM_MENU' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-md bg-dark-800/90 border-2 border-zinc-800 rounded-lg p-6 flex flex-col gap-6 shadow-2xl relative"
            >
              <h2 className="text-xl font-black text-white tracking-widest text-neon-glow flex justify-center items-center gap-2">
                {t('custom_room', 'CUSTOM ROOM')}
              </h2>
              <div className="flex flex-col gap-4">
                <button
                  onClick={createCustomRoom}
                  className="w-full bg-neon-red hover:bg-red-600 text-black font-black py-3 rounded tracking-widest font-display text-sm transition-all"
                >
                  {t('create_room', 'CREATE ROOM')}
                </button>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={t("enter_room_code")}
                    value={customCodeInput}
                    onChange={(e) => setCustomCodeInput(e.target.value.toUpperCase())}
                    className="w-full bg-dark-900 border border-zinc-800 focus:border-neon-cyan rounded px-3 py-2 text-sm font-mono text-white tracking-widest outline-none transition-colors text-center"
                  />
                </div>
                <button
                  onClick={joinCustomRoom}
                  className="w-full bg-transparent border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/10 font-black py-3 rounded tracking-widest font-display text-sm transition-all"
                >
                  {t('join_room', 'JOIN ROOM')}
                </button>
                <button
                  onClick={leaveLobbyAndReset}
                  className="text-xs text-zinc-500 font-mono tracking-widest hover:text-white transition-colors"
                >
                  {t('cancel', 'CANCEL')}
                </button>
                {customError && <div className="text-neon-red text-xs font-mono">{customError}</div>}
              </div>
            </motion.div>
          )}

          {/* CUSTOM_LOBBY SCREEN */}
          {screen === 'CUSTOM_LOBBY' && customRoom && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-md bg-dark-800/90 border-2 border-zinc-800 rounded-lg p-6 flex flex-col gap-6 shadow-2xl relative"
            >
              <h2 className="text-xl font-black text-white tracking-widest text-neon-glow flex justify-center items-center gap-2">
                {t('custom_room', 'CUSTOM ROOM')}
              </h2>
              <div className="bg-black p-3 rounded border border-zinc-800 text-center mb-4">
                <span className="text-zinc-500 text-xs font-mono">ROOM CODE: </span>
                <span className="text-neon-cyan font-black tracking-widest">{customRoom.code}</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs font-mono text-zinc-400">
                  <span>P1: {customRoom.players[0]?.username || t("waiting")}</span>
                  <span>P2: {customRoom.players[1]?.username || t("waiting")}</span>
                </div>
              </div>
              <div className="flex flex-col gap-3 mt-4">
                <button
                  onClick={startCustomBattle}
                  disabled={customRoom.players.length < 2 || customRoom.players[0]?.socketId !== socket.id}
                  className="w-full bg-neon-red hover:bg-red-600 disabled:opacity-50 text-black font-black py-3 rounded tracking-widest font-display text-sm transition-all"
                >
                  {t('start_match', 'START MATCH')}
                </button>
                <button
                  onClick={leaveLobbyAndReset}
                  className="text-xs text-zinc-500 font-mono tracking-widest hover:text-white transition-colors"
                >
                  {t('cancel', 'CANCEL')}
                </button>
              </div>
            </motion.div>
          )}

          {/* TOURNAMENT_MENU SCREEN */}
          {screen === 'TOURNAMENT_MENU' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-md bg-dark-800/90 border-2 border-zinc-800 rounded-lg p-6 flex flex-col gap-6 shadow-2xl relative"
            >
              <h2 className="text-xl font-black text-white tracking-widest text-yellow-400 flex justify-center items-center gap-2">
                {t('tournament_room', 'TOURNAMENT')}
              </h2>
              <div className="flex flex-col gap-4">
                <button
                  onClick={createTournament}
                  className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-black py-3 rounded tracking-widest font-display text-sm transition-all"
                >
                  {t('create_room', 'CREATE TOURNAMENT')}
                </button>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={t("enter_tournament_code")}
                    value={tCodeInput}
                    onChange={(e) => setTCodeInput(e.target.value.toUpperCase())}
                    className="w-full bg-dark-900 border border-zinc-800 focus:border-yellow-400 rounded px-3 py-2 text-sm font-mono text-white tracking-widest outline-none transition-colors text-center"
                  />
                </div>
                <button
                  onClick={joinTournament}
                  className="w-full bg-transparent border border-yellow-400 text-yellow-400 hover:bg-yellow-400/10 font-black py-3 rounded tracking-widest font-display text-sm transition-all"
                >
                  {t('join_room', 'JOIN TOURNAMENT')}
                </button>
                <button
                  onClick={leaveLobbyAndReset}
                  className="text-xs text-zinc-500 font-mono tracking-widest hover:text-white transition-colors"
                >
                  {t('cancel', 'CANCEL')}
                </button>
                {tError && <div className="text-neon-red text-xs font-mono">{tError}</div>}
              </div>
            </motion.div>
          )}

          {/* TOURNAMENT_LOBBY SCREEN */}
          {screen === 'TOURNAMENT_LOBBY' && tournament && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-md bg-dark-800/90 border-2 border-zinc-800 rounded-lg p-6 flex flex-col gap-6 shadow-2xl relative"
            >
              <h2 className="text-xl font-black text-white tracking-widest text-yellow-400 flex justify-center items-center gap-2">
                {t('tournament_room', 'TOURNAMENT')}
              </h2>
              <div className="bg-black p-3 rounded border border-zinc-800 text-center mb-4">
                <span className="text-zinc-500 text-xs font-mono">CODE: </span>
                <span className="text-yellow-400 font-black tracking-widest">{tournament.code}</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="text-xs font-mono text-zinc-400">
                  {t("players")}{tournament.players.length}
                </div>
              </div>
              <div className="flex flex-col gap-3 mt-4">
                <button
                  onClick={startTournament}
                  disabled={tournament.players.length < 2 || tournament.players[0]?.id !== socket.id}
                  className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-black font-black py-3 rounded tracking-widest font-display text-sm transition-all"
                >
                  {t('start_match', 'START TOURNAMENT')}
                </button>
                <button
                  onClick={leaveLobbyAndReset}
                  className="text-xs text-zinc-500 font-mono tracking-widest hover:text-white transition-colors"
                >
                  {t('cancel', 'CANCEL')}
                </button>
              </div>
            </motion.div>
          )}

          {/* 3. BATTLE ARENA SCREEN */}
          {screen === 'BATTLE' && (
            <motion.div 
              key="battle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-7xl flex flex-col gap-4 relative mx-auto"
            >
              {/* Battle HUD Header */}
              <div className="flex justify-between items-center bg-black/80 px-4 py-2 border border-zinc-800 rounded-lg backdrop-blur-sm font-mono text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">ROOM ID:</span>
                  <span className="text-white tracking-widest">{roomId?.slice(-8)}</span>
                </div>
                <div className="bg-neon-red/10 border border-neon-red/30 px-3 py-1 rounded text-neon-red font-black flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-red" />
                  RTC STABLE // P2P CONNECTED
                </div>
              </div>

              {/* Dynamic Camera Grid layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Local Feed */}
                <div className="relative">
                  <CameraStream
                    stream={localStream}
                    isLocal={true}
                    canvasRef={localCanvasRef}
                    videoRef={localVideoRef}
                    scores={localScores}
                    combatType={localCombatType}
                    fraudAlerts={localFraud}
                    playerName={username}
                  />
                  <div className="absolute top-3 right-3 bg-neon-red text-black text-[9px] font-black px-1.5 py-0.5 rounded tracking-widest">
                    {t("p1_you")}
                  </div>
                </div>

                {/* Opponent Feed */}
                <div className="relative">
                  <CameraStream
                    stream={remoteStream}
                    isLocal={false}
                    canvasRef={remoteCanvasRef}
                    // Since opponent scoring runs locally on their end and is sent via server,
                    // we show mock scores during the fight or a loading placeholder
                    scores={battlePhase === 'FIGHT' ? { symmetry: 80, jawline: 78, canthalTilt: 1.5, mewing: 85, finalScore: 82 } : null}
                    combatType={opponentInfo?.rank || 'MOGGER'}
                    playerName={opponentInfo?.username}
                  />
                  <div className="absolute top-3 right-3 bg-neon-cyan text-black text-[9px] font-black px-1.5 py-0.5 rounded tracking-widest">
                    {t("p2_opponent")}
                  </div>
                </div>
              </div>

              {/* Game phase layout overlay (countdown overlay or fight timer indicator) */}
              <AnimatePresence>
                {battlePhase === 'WAITING_PEERS' && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-3 rounded-lg border border-zinc-800 z-30"
                  >
                    <CrosshairIcon className="w-12 h-12 text-neon-red animate-spin" />
                    <h3 className="font-display text-lg font-black tracking-widest uppercase text-neon-glow">
                      {t('establishing_peer', 'ESTABLISHING PEER CHANNEL')}
                    </h3>
                    <p className="font-mono text-xs text-zinc-500">
                      {t('syncing_cameras', 'Syncing cameras and initializing AI detector models...')}
                    </p>
                  </motion.div>
                )}

                {battlePhase === 'COUNTDOWN' && (
                  <motion.div 
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.5, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                    className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
                  >
                    <div className="bg-black/90 px-10 py-6 border-2 border-neon-red text-center rounded-lg shadow-[0_0_50px_rgba(255,0,60,0.5)] crt-flicker">
                      <div className="text-[10px] font-mono text-zinc-500 tracking-widest mb-1">{t('battle_begins_in', 'MOG BATTLE BEGINS IN')}</div>
                      <h4 className="text-6xl md:text-8xl font-black font-display text-neon-red text-neon-glow animate-pulse">
                        {countdownText}
                      </h4>
                    </div>
                  </motion.div>
                )}

                {battlePhase === 'FIGHT' && (
                  <div className="w-full flex flex-col items-center gap-2 mt-2">
                    {/* Fight Timer Gauge */}
                    <div className="w-full h-2 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-neon-red to-neon-pink transition-all duration-1000 ease-linear shadow-[0_0_10px_#ff003c]" 
                        style={{ width: `${(fightTimer / 10) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between w-full font-mono text-[10px] text-zinc-500 px-1 uppercase">
                      <span>{t('stretch_muscles', 'STRETCH THOSE MUSCLES')}</span>
                      <span className="text-neon-red font-black animate-pulse">{t('time_remaining', 'MOG TIME REMAINING:')} {fightTimer}S</span>
                    </div>
                  </div>
                )}

                {battlePhase === 'RESOLVING' && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3 rounded-lg border border-zinc-800 z-30"
                  >
                    <div className="text-3xl font-black font-display text-white animate-pulse tracking-widest">
                      {t("calculating_outcome")}
                    </div>
                    <p className="font-mono text-xs text-neon-cyan">
                      {t("aggregating_data")}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* 4. RESULT SCREEN */}
          {screen === 'RESULT' && battleResult && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-black border-4 border-neon-red rounded-lg p-6 flex flex-col gap-6 shadow-[0_0_50px_rgba(255,0,60,0.25)] relative"
            >
              {/* Winner Flashing Banner */}
              <div className="text-center border-b border-zinc-800 pb-4">
                <div className="flex justify-center mb-2">
                  <div className="bg-neon-red/10 border border-neon-red p-2 rounded-full shadow-[0_0_15px_rgba(255,0,60,0.3)] animate-pulse">
                    <Crown className="w-10 h-10 text-neon-red" />
                  </div>
                </div>
                
                {roleToSelf(battleResult, playerRole).socketId === battleResult.winner ? (
                  <h2 className="text-3xl md:text-5xl font-black font-display text-neon-cyan text-neon-cyan tracking-widest glitch-text" data-text={t("you_mogged")}>
                    {t("you_mogged")}
                  </h2>
                ) : battleResult.winner === null ? (
                  <h2 className="text-3xl md:text-5xl font-black font-display text-white tracking-widest">
                    {t("mutual_draw")}
                  </h2>
                ) : (
                  <h2 className="text-3xl md:text-5xl font-black font-display text-neon-red text-neon-glow tracking-widest animate-shake" data-text={t("got_mogged")}>
                    {t("got_mogged")}
                  </h2>
                )}
                
                <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase tracking-widest">
                  {t("match_resolution")}{battleResult.reason}
                </p>
              </div>

              {/* Side-by-Side scoreboard cards */}
              <div className="grid grid-cols-2 gap-4">
                {/* Self card */}
                <div className="bg-zinc-950 p-4 border border-zinc-800 rounded font-mono flex flex-col gap-3 shadow-inner">
                  <div className="text-zinc-500 text-[10px] uppercase">{t("p1_you")}</div>
                  <div className="font-display font-black text-sm text-neon-cyan truncate">
                    {roleToSelf(battleResult, playerRole).username}
                  </div>
                  <div className="bg-zinc-900 p-2 rounded border border-zinc-800 text-center">
                    <div className="text-[9px] text-zinc-500 uppercase">{t("mog_score")}</div>
                    <div className="text-2xl font-black text-white">
                      {roleToSelf(battleResult, playerRole).score}
                    </div>
                  </div>
                  <div className="text-[9px] text-zinc-400 grid grid-cols-2 gap-x-2 gap-y-1 border-t border-zinc-900 pt-2">
                    <div className="flex justify-between border-b border-zinc-900/50 pb-0.5">
                      <span>{t("type")}</span>
                      <span className="text-white font-bold truncate max-w-[65px]">
                        {roleToSelf(battleResult, playerRole).combatType ? t(roleToSelf(battleResult, playerRole).combatType, roleToSelf(battleResult, playerRole).combatType) : 'MOGGER'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-900/50 pb-0.5">
                      <span>{t("tilt")}</span>
                      <span className="text-white font-bold">
                        {roleToSelf(battleResult, playerRole).details?.canthalTilt >= 0 ? '+' : ''}
                        {roleToSelf(battleResult, playerRole).details?.canthalTilt}°
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-900/50 pb-0.5">
                      <span>{t("sym")}</span>
                      <span className="text-white font-bold">
                        {roleToSelf(battleResult, playerRole).details?.symmetry || 0}%
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-900/50 pb-0.5">
                      <span>{t("jaw")}</span>
                      <span className="text-white font-bold">
                        {roleToSelf(battleResult, playerRole).details?.jawline || 0}%
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-900/50 pb-0.5">
                      <span>{t("gaze")}</span>
                      <span className="text-white font-bold">
                        {roleToSelf(battleResult, playerRole).details?.hunterGaze || 0}%
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-900/50 pb-0.5">
                      <span>{t("mew")}</span>
                      <span className="text-white font-bold">
                        {roleToSelf(battleResult, playerRole).details?.mewing || 0}%
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-900/50 pb-0.5">
                      <span>{t("brow")}</span>
                      <span className="text-white font-bold">
                        {roleToSelf(battleResult, playerRole).details?.browCompactness || 0}%
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-900/50 pb-0.5">
                      <span>{t("mid")}</span>
                      <span className="text-white font-bold">
                        {roleToSelf(battleResult, playerRole).details?.midfaceRatio || 0}%
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-900/50 pb-0.5">
                      <span>{t("lips")}</span>
                      <span className="text-white font-bold">
                        {roleToSelf(battleResult, playerRole).details?.lipRatio || 0}%
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-900/50 pb-0.5">
                      <span>{t("thirds")}</span>
                      <span className="text-white font-bold">
                        {roleToSelf(battleResult, playerRole).details?.facialThirds || 0}%
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] border-t border-zinc-900 pt-1.5 font-bold">
                    <span>{t("elo")}</span>
                    <span className={roleToSelf(battleResult, playerRole).eloChange >= 0 ? 'text-neon-cyan' : 'text-neon-red'}>
                      {roleToSelf(battleResult, playerRole).eloChange >= 0 ? '+' : ''}
                      {roleToSelf(battleResult, playerRole).eloChange}
                    </span>
                  </div>
                </div>

                {/* Opponent card */}
                <div className="bg-zinc-950 p-4 border border-zinc-800 rounded font-mono flex flex-col gap-3 shadow-inner">
                  <div className="text-zinc-500 text-[10px] uppercase">{t("p2_opponent")}</div>
                  <div className="font-display font-black text-sm text-zinc-300 truncate">
                    {roleToOpponent(battleResult, playerRole).username}
                  </div>
                  <div className="bg-zinc-900 p-2 rounded border border-zinc-800 text-center">
                    <div className="text-[9px] text-zinc-500 uppercase">{t("mog_score")}</div>
                    <div className="text-2xl font-black text-white">
                      {roleToOpponent(battleResult, playerRole).score}
                    </div>
                  </div>
                  <div className="text-[9px] text-zinc-400 grid grid-cols-2 gap-x-2 gap-y-1 border-t border-zinc-900 pt-2">
                    <div className="flex justify-between border-b border-zinc-900/50 pb-0.5">
                      <span>{t("type")}</span>
                      <span className="text-white font-bold truncate max-w-[65px]">
                        {roleToOpponent(battleResult, playerRole).combatType ? t(roleToOpponent(battleResult, playerRole).combatType, roleToOpponent(battleResult, playerRole).combatType) : 'MOGGER'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-900/50 pb-0.5">
                      <span>{t("tilt")}</span>
                      <span className="text-white font-bold">
                        {roleToOpponent(battleResult, playerRole).details?.canthalTilt >= 0 ? '+' : ''}
                        {roleToOpponent(battleResult, playerRole).details?.canthalTilt}°
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-900/50 pb-0.5">
                      <span>{t("sym")}</span>
                      <span className="text-white font-bold">
                        {roleToOpponent(battleResult, playerRole).details?.symmetry || 0}%
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-900/50 pb-0.5">
                      <span>{t("jaw")}</span>
                      <span className="text-white font-bold">
                        {roleToOpponent(battleResult, playerRole).details?.jawline || 0}%
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-900/50 pb-0.5">
                      <span>{t("gaze")}</span>
                      <span className="text-white font-bold">
                        {roleToOpponent(battleResult, playerRole).details?.hunterGaze || 0}%
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-900/50 pb-0.5">
                      <span>{t("mew")}</span>
                      <span className="text-white font-bold">
                        {roleToOpponent(battleResult, playerRole).details?.mewing || 0}%
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-900/50 pb-0.5">
                      <span>{t("brow")}</span>
                      <span className="text-white font-bold">
                        {roleToOpponent(battleResult, playerRole).details?.browCompactness || 0}%
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-900/50 pb-0.5">
                      <span>{t("mid")}</span>
                      <span className="text-white font-bold">
                        {roleToOpponent(battleResult, playerRole).details?.midfaceRatio || 0}%
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-900/50 pb-0.5">
                      <span>{t("lips")}</span>
                      <span className="text-white font-bold">
                        {roleToOpponent(battleResult, playerRole).details?.lipRatio || 0}%
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-900/50 pb-0.5">
                      <span>{t("thirds")}</span>
                      <span className="text-white font-bold">
                        {roleToOpponent(battleResult, playerRole).details?.facialThirds || 0}%
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] border-t border-zinc-900 pt-1.5 font-bold">
                    <span>{t("elo")}</span>
                    <span className={roleToOpponent(battleResult, playerRole).eloChange >= 0 ? 'text-neon-cyan' : 'text-neon-red'}>
                      {roleToOpponent(battleResult, playerRole).eloChange >= 0 ? '+' : ''}
                      {roleToOpponent(battleResult, playerRole).eloChange}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Play Again & Export Clips */}
              <div className="flex flex-col sm:flex-row gap-3 mt-2">
                <button
                  onClick={mogAgain}
                  className="flex-1 bg-neon-red hover:bg-red-600 text-black font-black py-3 rounded tracking-widest font-display text-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(255,0,60,0.2)]"
                >
                  <RotateCcw className="w-4 h-4" />
                  MOG AGAIN
                </button>

                <button
                  onClick={() => alert("AUTO-GENERATING TIKTOK EDIT CLIP...\nRemotion worker initialized in background.")}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-neon-cyan text-white font-black py-3 rounded tracking-widest font-display text-sm flex items-center justify-center gap-2 transition-all"
                >
                  <Share2 className="w-4 h-4 text-neon-cyan" />
                  EXPORT CLIPS
                </button>
              </div>
            </motion.div>
          )}

          {/* 5. SOLO TRAINING PRACTICE SCREEN */}
          {screen === 'TRAINING' && (
            <motion.div 
              key="training"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-4xl flex flex-col gap-4 relative"
            >
              {/* Training HUD Header */}
              <div className="flex justify-between items-center bg-black/80 px-4 py-2 border border-zinc-800 rounded-lg backdrop-blur-sm font-mono text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">MODE:</span>
                  <span className="text-neon-cyan tracking-widest font-bold">{t('solo_practice_arena', 'SOLO PRACTICE ARENA')}</span>
                </div>
                <div className="bg-neon-cyan/10 border border-neon-cyan/30 px-3 py-1 rounded text-neon-cyan font-black flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan" />
                  {t('real_time_assessment_active', 'REAL-TIME ASSESSMENT ACTIVE')}
                </div>
              </div>

              {/* Dynamic Camera Grid layout for Training */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Local Feed */}
                <div className="relative">
                  <CameraStream
                    stream={localStream}
                    isLocal={true}
                    canvasRef={localCanvasRef}
                    videoRef={localVideoRef}
                    scores={localScores}
                    combatType={localCombatType}
                    playerName={username}
                  />
                  <div className="absolute top-3 right-3 bg-neon-cyan text-black text-[9px] font-black px-1.5 py-0.5 rounded tracking-widest">
                    {t('practice_feed', 'PRACTICE FEED')}
                  </div>
                </div>

                {/* Training Guide / Tips & Real-time Feedback */}
                <div className="bg-dark-800/90 border-2 border-zinc-800 rounded-lg p-5 flex flex-col gap-4 shadow-2xl relative min-h-[300px]">
                  {/* Corner Sci-Fi Decorators */}
                  <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-neon-cyan" />
                  <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-neon-cyan" />

                  <h3 className="font-display text-sm font-black text-white tracking-widest border-b border-zinc-800 pb-2 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-neon-cyan" />
                    {t("ai_mog_coach")}
                  </h3>

                  <div className="flex flex-col gap-3 font-mono text-xs text-zinc-300 flex-grow">
                    {localScores && localScores.finalScore > 0 ? (
                      <>
                        <div className="bg-black/40 p-3 border border-zinc-800/80 rounded flex flex-col gap-1">
                          <span className="text-[10px] text-zinc-500 uppercase">{t("current_performance_tier")}</span>
                          <span className="text-neon-cyan font-bold uppercase text-sm tracking-wider">
                            {localCombatType ? t(localCombatType, localCombatType) : t('analyzing', 'ANALYZING...')}
                          </span>
                        </div>

                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] text-zinc-500 uppercase">{t("mog_coach_tips")}</span>
                          
                          {/* Symmetry Tip */}
                          {localScores.symmetry < 85 && (
                            <div className="border-l-2 border-amber-500 pl-2 py-0.5">
                              <span className="text-amber-500 font-bold">[SYMMETRY]</span> Center your face in the frame and ensure balanced side lighting.
                            </div>
                          )}
                          
                          {/* Jawline Tip */}
                          {localScores.jawline < 82 && (
                            <div className="border-l-2 border-amber-500 pl-2 py-0.5">
                              <span className="text-amber-500 font-bold">[JAWLINE]</span> Clench your teeth slightly or posture your chin forward for definition.
                            </div>
                          )}
                          
                          {/* Mewing Tip */}
                          {localScores.mewing < 85 && (
                            <div className="border-l-2 border-neon-cyan pl-2 py-0.5">
                              <span className="text-neon-cyan font-bold">[MEWING]</span> Press your tongue firmly against your upper palate.
                            </div>
                          )}

                          {/* Hunter Gaze Tip */}
                          {localScores.hunterGaze < 82 && (
                            <div className="border-l-2 border-neon-cyan pl-2 py-0.5">
                              <span className="text-neon-cyan font-bold">[HUNTER GAZE]</span> Relax the upper eyelids and elevate the lower lids slightly.
                            </div>
                          )}

                          {localScores.symmetry >= 85 && localScores.jawline >= 82 && localScores.mewing >= 85 && localScores.hunterGaze >= 82 && (
                            <div className="border-l-2 border-green-500 pl-2 py-0.5 text-green-400 font-bold animate-pulse">
                              [ELITE FORM] Your looksmaxxing parameters are highly optimized! Keep up this posture!
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-center py-6">
                        <CrosshairIcon className="w-8 h-8 animate-spin text-neon-red" />
                        <span className="tracking-widest text-[10px] text-zinc-400">{t("connecting_video")}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={stopTraining}
                    className="w-full bg-zinc-900 border border-zinc-800 hover:border-neon-cyan text-zinc-400 hover:text-white py-2.5 rounded text-xs font-mono tracking-widest uppercase transition-colors"
                  >
                    {t("quit_practice")}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {(screen === 'BATTLE' || screen === 'TRAINING') && (
        <TechnicalPanel scores={localScores} combatType={localCombatType} />
      )}
{isSettingsOpen && <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />}
      {/* Cyberpunk Footer Decorator */}
      <footer className="relative z-10 w-full flex flex-col md:flex-row justify-between items-center border-t border-zinc-800 pt-3 text-[9px] md:text-xs font-mono text-zinc-600 uppercase">
        <div className="flex items-center gap-2 mb-2 md:mb-0">
          <Terminal className="w-3.5 h-3.5 text-neon-red" />
          <span>SYSTEM GATEWAY // STATUS: SECURED_NODE_SHARD</span>
        </div>
        <div className="flex items-center gap-4">
          <span>SECURE_SHA256 // ENCRYPTED_SCORES</span>
          <span className="text-neon-cyan hidden md:inline">BY BABAFLEX31</span>
        </div>
      </footer>
    </div>
  );
}
