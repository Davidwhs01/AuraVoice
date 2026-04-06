// ============================================
// WebRTC Manager Module (Supabase Realtime)
// ============================================

window.WebRTCManager = (() => {
  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ];

  // Quality Settings
  let qualitySettings = {
    video: {
      width: 3840,
      height: 2160,
      fps: 120,
      bitrate: 20000000
    },
    audio: {
      sampleRate: 48000,
      channels: 2,
      processing: 'none'
    }
  };

  let localStream = null;
  let screenStream = null;
  let peers = {};
  let screenPeers = {};
  let isMuted = false;
  let isDeafened = false;
  let isScreenSharing = false;
  let onSpeakingCallback = null;
  let onRemoteScreenCallback = null;

  // Audio analysis
  let audioContext = null;
  let analyser = null;
  let speakingCheckInterval = null;
  let wasSpeaking = false;

  function init() {
    // Setup signaling via RealtimeManager (done in app.js)
  }

  function createPeerConnection(remoteSocketId) {
    if (peers[remoteSocketId]) {
      peers[remoteSocketId].close();
    }

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      googCableAgnent: true,
      googIPv6: true
    });

    const { video: vid } = qualitySettings;
    pc.getSenders().forEach(sender => {
      if (sender.track && sender.track.kind === 'video') {
        sender.setParameters({ 
          maxBitrate: vid.bitrate,
          'maxFramerate': vid.fps
        });
      }
    });

    peers[remoteSocketId] = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        RealtimeManager.sendIceCandidate(remoteSocketId, event.candidate);
      }
    };

    pc.ontrack = (event) => {
      console.log(`🔊 Track recebida de ${remoteSocketId}:`, event.track.kind);
      if (event.track.kind === 'audio') {
        const audio = document.createElement('audio');
        audio.srcObject = event.streams[0];
        audio.autoplay = true;
        audio.playsInline = true;
        audio.id = `remote-audio-${remoteSocketId}`;
        audio.volume = 1.0;
        audio.dataset.volume = '1.0';
        
        const old = document.getElementById(`remote-audio-${remoteSocketId}`);
        if (old) old.remove();
        
        document.body.appendChild(audio);
        audio.play().catch(() => {});
        audio.muted = isDeafened;
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`📡 Conexão com ${remoteSocketId}: ${pc.connectionState}`);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        closePeer(remoteSocketId);
      }
    };

    return pc;
  }

  function createScreenPeerConnection(remoteSocketId, isSender) {
    if (screenPeers[remoteSocketId]) {
      screenPeers[remoteSocketId].close();
    }

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      googCableAgnent: true,
      googIPv6: true
    });

    const { video: vid } = qualitySettings;
    if (isSender && screenStream) {
      pc.getSenders().forEach(sender => {
        if (sender.track && sender.track.kind === 'video') {
          sender.setParameters({ 
            maxBitrate: vid.bitrate,
            'maxFramerate': vid.fps
          });
        }
      });
    }

    screenPeers[remoteSocketId] = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        RealtimeManager.sendScreenIceCandidate(remoteSocketId, event.candidate);
      }
    };

    if (!isSender) {
      pc.ontrack = (event) => {
        console.log(`🖥️ Screen track recebida de ${remoteSocketId}`);
        if (onRemoteScreenCallback) {
          onRemoteScreenCallback(remoteSocketId, event.streams[0]);
        }
      };
    }

    return pc;
  }

  async function startMicrophone() {
    try {
      const { audio } = qualitySettings;
      
      console.log('🎤 Iniciando microfone com config:', audio);
      
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: audio.sampleRate },
          channelCount: { ideal: audio.channels },
          echoCancellation: audio.processing !== 'none',
          noiseSuppression: audio.processing !== 'none',
          autoGainControl: audio.processing !== 'none',
          latency: 0
        },
        video: false
      });

      console.log('🎤 Microfone obtido, tracks:', localStream.getTracks().map(t => t.kind));

      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
      } catch(e) {}

      setupVoiceActivityDetection(localStream);
      console.log(`🎤 Microfone ativado (${audio.sampleRate/1000}kHz ${audio.channels === 2 ? 'Stereo' : 'Mono'})`);
      return true;
    } catch (err) {
      console.error('Erro ao acessar microfone:', err);
      if (typeof UI !== 'undefined') {
        UI.showToast('Não foi possível acessar o microfone', 'error');
      }
      return false;
    }
  }

  function setupVoiceActivityDetection(stream) {
    if (audioContext) audioContext.close();

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    if (speakingCheckInterval) clearInterval(speakingCheckInterval);

    speakingCheckInterval = setInterval(() => {
      if (isMuted) {
        if (wasSpeaking) {
          wasSpeaking = false;
          if (onSpeakingCallback) onSpeakingCallback(false);
        }
        return;
      }

      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const speaking = average > 15;

      if (speaking !== wasSpeaking) {
        wasSpeaking = speaking;
        if (onSpeakingCallback) onSpeakingCallback(speaking);
      }
    }, 100);
  }

  async function connectToPeer(remoteSocketId) {
    console.log(`🔗 Conectando ao peer: ${remoteSocketId}`);
    const pc = createPeerConnection(remoteSocketId);

    if (localStream) {
      console.log('🎤 Adicionando tracks do microfone ao peer');
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    } else {
      console.log('⚠️ Nenhum stream local para adicionar');
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    RealtimeManager.sendOffer(remoteSocketId, pc.localDescription);
  }

  function closePeer(socketId) {
    if (peers[socketId]) {
      peers[socketId].close();
      delete peers[socketId];
    }

    const audioEl = document.getElementById(`remote-audio-${socketId}`);
    if (audioEl) audioEl.remove();

    if (screenPeers[socketId]) {
      screenPeers[socketId].close();
      delete screenPeers[socketId];
    }
  }

  function closeAllPeers() {
    Object.keys(peers).forEach(closePeer);
    Object.keys(screenPeers).forEach(id => {
      screenPeers[id].close();
      delete screenPeers[id];
    });
  }

  function stopMicrophone() {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    if (speakingCheckInterval) {
      clearInterval(speakingCheckInterval);
      speakingCheckInterval = null;
    }
  }

  function toggleMute() {
    isMuted = !isMuted;
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
    return isMuted;
  }

  function toggleDeafen() {
    isDeafened = !isDeafened;
    
    if (isDeafened && !isMuted) {
      isMuted = true;
      if (localStream) {
        localStream.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
      }
    }
    
    if (!isDeafened && isMuted) {
      isMuted = false;
      if (localStream) {
        localStream.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
      }
    }

    document.querySelectorAll('audio[id^="remote-audio-"]').forEach(audio => {
      audio.muted = isDeafened;
    });

    return { isMuted, isDeafened };
  }

  async function startScreenShare() {
    try {
      const { video: vid } = qualitySettings;
      
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: vid.width },
          height: { ideal: vid.height },
          frameRate: { ideal: vid.fps, max: 144 },
          displaySurface: 'monitor',
          logicalSurface: true,
          cursor: 'always'
        },
        audio: true
      });

      isScreenSharing = true;

      // Mute microphone during screen share
      if (localStream) {
        localStream.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
      }

      // Send screen to all connected peers
      for (const remoteSocketId of Object.keys(peers)) {
        const pc = createScreenPeerConnection(remoteSocketId, true);
        screenStream.getTracks().forEach(track => {
          pc.addTrack(track, screenStream);
        });
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        RealtimeManager.sendScreenOffer(remoteSocketId, pc.localDescription);
      }

      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      RealtimeManager.sendScreenShareStarted();
      console.log(`🖥️ Screen share started: ${vid.width}x${vid.height} @ ${vid.fps}fps`);
      return screenStream;
    } catch (err) {
      console.error('Erro ao compartilhar tela:', err);
      if (err.name !== 'NotAllowedError') {
        if (typeof UI !== 'undefined') {
          UI.showToast('Erro ao compartilhar tela', 'error');
        }
      }
      return null;
    }
  }

  function stopScreenShare() {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      screenStream = null;
    }

    // Restore microphone
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }

    Object.keys(screenPeers).forEach(id => {
      screenPeers[id].close();
      delete screenPeers[id];
    });

    isScreenSharing = false;
    RealtimeManager.sendScreenShareStopped();
  }

  async function sendScreenToPeer(remoteSocketId) {
    if (!isScreenSharing || !screenStream) return;

    const pc = createScreenPeerConnection(remoteSocketId, true);
    screenStream.getTracks().forEach(track => {
      pc.addTrack(track, screenStream);
    });
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    RealtimeManager.sendScreenOffer(remoteSocketId, pc.localDescription);
  }

  function onSpeaking(callback) {
    onSpeakingCallback = callback;
  }

  function onRemoteScreen(callback) {
    onRemoteScreenCallback = callback;
  }

  function getQualitySettings() {
    return { ...qualitySettings };
  }

  function setQualitySettings(settings) {
    if (settings.video) {
      if (settings.video.resolution) {
        const [w, h] = settings.video.resolution.split('x').map(Number);
        qualitySettings.video.width = w;
        qualitySettings.video.height = h;
      }
      if (settings.video.fps) qualitySettings.video.fps = parseInt(settings.video.fps);
      if (settings.video.bitrate) qualitySettings.video.bitrate = parseInt(settings.video.bitrate);
    }
    if (settings.audio) {
      if (settings.audio.sampleRate) qualitySettings.audio.sampleRate = parseInt(settings.audio.sampleRate);
      if (settings.audio.channels) qualitySettings.audio.channels = parseInt(settings.audio.channels);
      if (settings.audio.processing) qualitySettings.audio.processing = settings.audio.processing;
    }
    console.log('⚙️ Configurações de qualidade atualizadas:', qualitySettings);
  }

  function setPeerVolume(socketId, volume) {
    console.log(`🔊 Setando volume ${volume} para ${socketId}`);
    const audio = document.getElementById(`remote-audio-${socketId}`);
    if (audio) {
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.dataset.volume = volume.toString();
      console.log(`✅ Volume aplicado: ${audio.volume}`);
    } else {
      console.log(`❌ Áudio não encontrado para ${socketId}`);
    }
  }

  function getPeerVolume(socketId) {
    const audio = document.getElementById(`remote-audio-${socketId}`);
    return audio ? parseFloat(audio.dataset.volume || 1.0) : 1.0;
  }

  function getLocalStream() {
    return localStream;
  }

  function getPeerConnection(socketId) {
    return peers[socketId] || null;
  }

  function createPeerConnectionPublic(remoteSocketId) {
    return createPeerConnection(remoteSocketId);
  }

  return {
    init,
    startMicrophone,
    stopMicrophone,
    connectToPeer,
    closePeer,
    closeAllPeers,
    toggleMute,
    toggleDeafen,
    startScreenShare,
    stopScreenShare,
    sendScreenToPeer,
    onSpeaking,
    onRemoteScreen,
    getQualitySettings,
    setQualitySettings,
    setPeerVolume,
    getPeerVolume,
    getLocalStream,
    getPeerConnection,
    createPeerConnection: createPeerConnectionPublic,
    getState: () => ({ isMuted, isDeafened, isScreenSharing, peerCount: Object.keys(peers).length })
  };
})();
