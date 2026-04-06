// ============================================
// Main Application Controller (Supabase Edition)
// ============================================

(() => {
  // ========== Server & Channel Data ==========
  const SERVERS = [
    {
      id: 'taverna-dkz',
      name: 'Taverna da DKZ',
      icon: '🛡️',
      color: '#a855f7',
      categories: [
        {
          name: 'Comunidade',
          channels: [
            { id: 'chat', name: 'chat', type: 'text' },
            { id: 'comandos', name: 'comandos', type: 'text' },
            { id: 'memes', name: 'memes', type: 'text' }
          ]
        },
        {
          name: 'CALLS',
          channels: [
            { id: 'dois-dedo-de-prosa', name: 'Dois dedo de prosa', type: 'voice' },
            { id: 'sabios', name: 'Sábios', type: 'voice' },
            { id: 'mal-remunerados', name: 'Mal remunerados', type: 'voice' },
            { id: 'sonegadores', name: 'Sonegadores', type: 'voice' },
            { id: 'aposentados', name: 'Aposentados', type: 'voice' },
            { id: 'so-o-po-da-rabiola', name: 'Só o pó da rabiola', type: 'voice' },
            { id: 'jogando', name: 'Jogando', type: 'voice' },
            { id: 'jogando-ii', name: 'Jogando II', type: 'voice' },
            { id: 'jogando-iii', name: 'Jogando III', type: 'voice' },
            { id: 'jogando-iv', name: 'Jogando IV', type: 'voice' },
            { id: 'amongas', name: 'Amongas', type: 'voice' },
            { id: 'fortnai', name: 'Fortnai', type: 'voice' },
            { id: 'cod', name: 'COD', type: 'voice' },
            { id: 'tombou', name: 'Tombou', type: 'voice' }
          ]
        },
        {
          name: 'jukebox',
          channels: [
            { id: 'rave-do-aki', name: 'Rave do AKI', type: 'voice' }
          ]
        },
        {
          name: 'Trabalhando',
          channels: [
            { id: 'gravando', name: 'Gravando', type: 'voice' },
            { id: 'produzindo', name: 'Produzindo', type: 'voice' },
            { id: 'editando', name: 'Editando', type: 'voice' },
            { id: 'desenhando', name: 'Desenhando', type: 'voice' }
          ]
        }
      ]
    }
  ];

  // ========== State ==========
  let socketId = null;
  let activeServerId = null;
  let activeChannelId = null;
  let currentRoomId = null;
  let username = '';
  let roomsSummary = {};
  let roomUsers = {};
  let speakingStates = {};
  let muteStates = {};
  let screenSharers = new Set();
  let localIsMuted = false;
  let localIsDeafened = false;
  let localIsScreenSharing = false;
  let peerVolumes = {};
  let avatarColor = null;

  // ========== Init ==========
  function init() {
    setupUsernameModal();
  }

  function setupUsernameModal() {
    const modal = document.getElementById('username-modal');
    const input = document.getElementById('username-input');
    const submit = document.getElementById('username-submit');

    submit.addEventListener('click', () => handleUsernameSubmit(input, modal));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleUsernameSubmit(input, modal);
    });
  }

  function handleUsernameSubmit(input, modal) {
    const name = input.value.trim();
    if (!name) {
      input.style.borderColor = '#ef4444';
      input.focus();
      return;
    }

    username = name;
    modal.classList.remove('active');
    document.getElementById('app').classList.remove('hidden');

    // Update user display
    document.getElementById('user-display-name').textContent = username;
    document.getElementById('user-avatar-letter').textContent = username[0].toUpperCase();

    // Generate socket ID and color
    socketId = 'user_' + Math.random().toString(36).substr(2, 9);
    avatarColor = getRandomColor();

    startApp();
  }

  function getRandomColor() {
    const colors = [
      '#7c3aed', '#a855f7', '#6366f1', '#ec4899', '#3b82f6',
      '#06b6d4', '#fbbf24', '#34d399', '#ef4444', '#8b5cf6'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function startApp() {
    // Initialize Realtime with Supabase
    const userData = {
      socketId: socketId,
      username: username,
      avatarColor: avatarColor,
      isMuted: false,
      isDeafened: false,
      isSpeaking: false,
      isScreenSharing: false
    };

    RealtimeManager.connect(userData);

    // Setup Realtime callbacks
    setupRealtimeCallbacks();

    // Setup UI
    setupUIListeners();

    // Render servers
    UI.renderServerIcons(SERVERS, activeServerId);

    // Select first server by default
    selectServer(SERVERS[0].id);

    console.log('✅ Conectado ao Supabase Realtime');
    UI.showToast(`Conectado como ${username}`, 'success');
  }

  // ========== Realtime Callbacks ==========
  function setupRealtimeCallbacks() {
    // When we join a room, get existing users
    RealtimeManager.onRoomUsersUpdatedCallback((users) => {
      console.log('👥 Room users updated:', Object.keys(users));
      roomUsers = users;
      renderCurrentVoiceUsers();
      
      // Connect to existing peers
      Object.keys(users).forEach(id => {
        if (id !== socketId) {
          WebRTCManager.connectToPeer(id);
        }
      });
    });

    // Peer connected
    RealtimeManager.onPeerConnectedCallback((peerData) => {
      console.log(`👋 ${peerData.username} entrou na sala`);
      roomUsers[peerData.socketId] = peerData;
      UI.showToast(`${peerData.username} entrou no canal`, 'info');
      renderCurrentVoiceUsers();
    });

    // Peer disconnected
    RealtimeManager.onPeerDisconnectedCallback((peerSocketId) => {
      console.log(`👋 Usuário saiu da sala: ${peerSocketId}`);
      delete roomUsers[peerSocketId];
      WebRTCManager.closePeer(peerSocketId);
      renderCurrentVoiceUsers();
    });

    // WebRTC Signaling
    RealtimeManager.onOfferCallback(async ({ senderId, offer }) => {
      console.log(`📨 Oferta recebida de ${senderId}`);
      const pc = WebRTCManager.createPeerConnection(senderId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      const localStream = WebRTCManager.getLocalStream();
      if (localStream) {
        localStream.getTracks().forEach(track => {
          pc.addTrack(track, localStream);
        });
      }
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      RealtimeManager.sendAnswer(senderId, pc.localDescription);
    });

    RealtimeManager.onAnswerCallback(async ({ senderId, answer }) => {
      console.log(`📨 Resposta recebida de ${senderId}`);
      // Answer handling is done in WebRTCManager
    });

    RealtimeManager.onIceCandidateCallback(async ({ senderId, candidate }) => {
      const pc = WebRTCManager.getPeerConnection(senderId);
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Erro ao adicionar ICE candidate:', e);
        }
      }
    });

    // Screen share
    RealtimeManager.onScreenShareStartedCallback(({ socketId: sharerId, username: sharerName }) => {
      screenSharers.add(sharerId);
      UI.showToast(`${sharerName} começou a compartilhar a tela`, 'info');
      
      // Mute all call audio for viewers
      document.querySelectorAll('audio[id^="remote-audio-"]').forEach(audio => {
        if (audio.id !== `remote-audio-${sharerId}`) {
          audio.dataset.wasPlaying = audio.volume > 0;
          audio.muted = true;
        }
      });
      
      renderCurrentVoiceUsers();
    });

    RealtimeManager.onScreenShareStoppedCallback(({ socketId: sharerId }) => {
      screenSharers.delete(sharerId);
      UI.removeScreenShareStream(sharerId);
      
      document.querySelectorAll('audio[id^="remote-audio-"]').forEach(audio => {
        audio.muted = localIsDeafened;
      });
      
      renderCurrentVoiceUsers();
    });

    // Speaking
    RealtimeManager.onSpeakingChangedCallback(({ socketId: sId, isSpeaking }) => {
      speakingStates[sId] = isSpeaking;
      UI.updateSpeakingState(sId, isSpeaking);
    });

    // Mute status
    RealtimeManager.onMuteStatusChangedCallback(({ socketId: sId, muted, deafened }) => {
      muteStates[sId] = { muted, deafened };
      renderCurrentVoiceUsers();
    });
  }

  // ========== UI Listeners ==========
  function setupUIListeners() {
    // Server icon clicks
    document.getElementById('server-list').addEventListener('click', (e) => {
      const serverIcon = e.target.closest('.server-icon');
      if (!serverIcon) return;

      const serverId = serverIcon.dataset.server;
      if (serverId === 'home') {
        selectServer(null);
        return;
      }
      if (serverIcon.classList.contains('add-server')) {
        UI.showToast('Criar servidor ainda não disponível no MVP', 'info');
        return;
      }
      if (serverId) {
        selectServer(serverId);
      }
    });

    // Channel clicks
    document.getElementById('channels-container').addEventListener('click', (e) => {
      const channelItem = e.target.closest('.channel-item');
      if (!channelItem) return;

      const channelId = channelItem.dataset.channelId;
      const channelType = channelItem.dataset.channelType;
      const channelName = channelItem.dataset.channelName;

      if (channelType === 'voice') {
        joinVoiceChannel(channelId, channelName);
      } else {
        UI.showToast('Chat de texto ainda não disponível no MVP', 'info');
      }
    });

    // Control buttons
    document.getElementById('btn-mute').addEventListener('click', async () => {
      localIsMuted = WebRTCManager.toggleMute();
      updateControlButtons();
      RealtimeManager.sendMuteStatus(localIsMuted, localIsDeafened);
    });

    document.getElementById('btn-deafen').addEventListener('click', async () => {
      const result = WebRTCManager.toggleDeafen();
      localIsMuted = result.isMuted;
      localIsDeafened = result.isDeafened;
      updateControlButtons();
      RealtimeManager.sendMuteStatus(localIsMuted, localIsDeafened);
    });

    document.getElementById('btn-screen-share').addEventListener('click', async () => {
      if (!localIsScreenSharing) {
        const stream = await WebRTCManager.startScreenShare();
        if (stream) {
          localIsScreenSharing = true;
          screenSharers.add(socketId);
          UI.setScreenShareStream(socketId, stream, username + ' (você)');
          RealtimeManager.sendScreenShareStarted();
          updateControlButtons();
          renderCurrentVoiceUsers();
        }
      } else {
        WebRTCManager.stopScreenShare();
        localIsScreenSharing = false;
        screenSharers.delete(socketId);
        UI.removeScreenShareStream(socketId);
        RealtimeManager.sendScreenShareStopped();
        updateControlButtons();
        renderCurrentVoiceUsers();
      }
    });

    // Disconnect button
    document.getElementById('btn-disconnect').addEventListener('click', () => {
      leaveVoiceChannel();
    });

    // Quality button in voice header
    document.getElementById('btn-quality').addEventListener('click', () => {
      console.log('🎛️ Quality button clicked!');
      UI.openQualityModal();
    });

    // Settings button in user panel
    document.getElementById('btn-settings').addEventListener('click', () => {
      UI.showToast('Configurações em breve!', 'info');
    });

    // Quality modal
    document.getElementById('quality-modal-close').addEventListener('click', () => {
      UI.closeQualityModal();
    });

    document.getElementById('quality-modal').addEventListener('click', (e) => {
      if (e.target.id === 'quality-modal') {
        UI.closeQualityModal();
      }
    });

    document.getElementById('quality-save').addEventListener('click', () => {
      const settings = {
        video: {
          resolution: document.getElementById('quality-resolution').value,
          fps: document.getElementById('quality-fps').value,
          bitrate: document.getElementById('quality-bitrate').value
        },
        audio: {
          sampleRate: document.getElementById('quality-audio-sample').value,
          channels: document.getElementById('quality-audio-channels').value,
          processing: document.getElementById('quality-audio-processing').value
        }
      };
      
      WebRTCManager.setQualitySettings(settings);
      UI.closeQualityModal();
      UI.showToast('Configurações de qualidade salvas!', 'success');
    });
  }

  // ========== Server Selection ==========
  function selectServer(serverId) {
    activeServerId = serverId;

    // Update server icons
    document.querySelectorAll('.server-icon').forEach(icon => {
      icon.classList.toggle('active', icon.dataset.server === (serverId || 'home'));
    });

    if (serverId) {
      const server = SERVERS.find(s => s.id === serverId);
      if (server) {
        UI.renderChannels(server, activeChannelId, roomsSummary);
      }
    } else {
      document.getElementById('server-name').textContent = 'AuraVoice';
      document.getElementById('channels-container').innerHTML = `
        <div style="padding: 16px; color: var(--text-muted); font-size: 14px; text-align: center;">
          <p style="margin-bottom: 8px;">👋 Selecione um servidor</p>
          <p>na barra lateral esquerda</p>
        </div>
      `;
    }
  }

  // ========== Voice Channel ==========
  async function joinVoiceChannel(channelId, channelName) {
    const newRoomId = `${activeServerId}:${channelId}`;
    if (newRoomId === currentRoomId) return;

    // Leave previous room
    if (currentRoomId) {
      await RealtimeManager.leaveRoom();
      WebRTCManager.closeAllPeers();
      WebRTCManager.stopMicrophone();
    }

    currentRoomId = newRoomId;
    activeChannelId = channelId;
    roomUsers = {};
    speakingStates = {};
    muteStates = {};
    screenSharers.clear();
    muteStates[socketId] = { muted: false, deafened: false };

    // Join new room in Supabase Realtime
    await RealtimeManager.joinRoom(currentRoomId);
    
    // Update presence with current state
    RealtimeManager.updatePresence({
      username,
      avatarColor,
      isMuted: localIsMuted,
      isDeafened: localIsDeafened
    });

    // Start microphone
    await WebRTCManager.startMicrophone();

    // Setup WebRTC callbacks
    WebRTCManager.onSpeaking((isSpeaking) => {
      speakingStates[socketId] = isSpeaking;
      UI.updateSpeakingState(socketId, isSpeaking);
      RealtimeManager.sendSpeaking(isSpeaking);
    });

    // Update control buttons
    updateControlButtons();

    // Show voice view
    UI.showVoiceView(channelName);

    UI.showToast(`Conectado a ${channelName}`, 'success');
    console.log(`🔊 Entrou no canal: ${channelName} (${currentRoomId})`);
  }

  function leaveVoiceChannel() {
    if (!currentRoomId) return;

    // Stop screen sharing
    if (localIsScreenSharing) {
      WebRTCManager.stopScreenShare();
      localIsScreenSharing = false;
    }

    // Close all peer connections
    WebRTCManager.closeAllPeers();
    WebRTCManager.stopMicrophone();

    // Leave room in Supabase
    RealtimeManager.leaveRoom();

    const channelName = activeChannelId;
    currentRoomId = null;
    activeChannelId = null;
    roomUsers = {};
    speakingStates = {};
    muteStates = {};
    screenSharers.clear();

    // Update UI
    UI.hideVoiceView();

    // Re-render channels
    if (activeServerId) {
      const server = SERVERS.find(s => s.id === activeServerId);
      if (server) {
        UI.renderChannels(server, null, roomsSummary);
      }
    }

    UI.showToast('Desconectado do canal de voz', 'info');
    console.log('🔇 Saiu do canal de voz');
  }

  // ========== Helpers ==========
  function renderCurrentVoiceUsers() {
    if (!currentRoomId || !roomUsers) return;
    UI.renderVoiceUsers(roomUsers, socketId, speakingStates, muteStates, screenSharers);
    
    // Setup volume slider events
    document.querySelectorAll('.volume-slider').forEach(slider => {
      const sId = slider.dataset.socketId;
      
      // Load saved volume or default to 100%
      const savedVolume = peerVolumes[sId] !== undefined ? peerVolumes[sId] : 1.0;
      slider.value = savedVolume * 100;
      
      slider.addEventListener('input', (e) => {
        const volume = e.target.value / 100;
        peerVolumes[sId] = volume;
        WebRTCManager.setPeerVolume(sId, volume);
      });
    });
  }

  function updateControlButtons() {
    const muteBtn = document.getElementById('btn-mute');
    const deafenBtn = document.getElementById('btn-deafen');
    const screenBtn = document.getElementById('btn-screen-share');

    muteBtn.classList.toggle('active', localIsMuted);
    deafenBtn.classList.toggle('active', localIsDeafened);
    screenBtn.classList.toggle('active', localIsScreenSharing);
  }

  // ========== Start ==========
  document.addEventListener('DOMContentLoaded', init);
})();
