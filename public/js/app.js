// ============================================
// Main Application Controller (Supabase + Auth)
// ============================================

import { signUp, signIn, signOut, getSession, getUser } from './supabase.js';

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
            { id: 'jogando', name: 'Jogando', type: 'voice' },
            { id: 'fortnai', name: 'Fortnai', type: 'voice' }
          ]
        }
      ]
    }
  ];

  // ========== State ==========
  let currentUser = null;
  let username = null;
  let activeServerId = null;
  let activeChannelId = null;
  let currentRoomId = null;
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
  let socketId = null;

  // ========== Init ==========
  async function init() {
    // Check for existing session
    const session = await getSession();
    if (session) {
      currentUser = session.user;
      avatarColor = getRandomColor();
      username = session.user.user_metadata?.username || session.user.email.split('@')[0];
      socketId = 'user_' + Math.random().toString(36).substr(2, 9);
      showApp();
    } else {
      setupAuthModal();
    }
  }

  function setupAuthModal() {
    // Login form
    document.getElementById('login-submit').addEventListener('click', handleLogin);
    document.getElementById('login-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLogin();
    });

    // Register form
    document.getElementById('register-submit').addEventListener('click', handleRegister);
    document.getElementById('register-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleRegister();
    });

    // Switch between forms
    document.getElementById('show-register').addEventListener('click', () => {
      document.getElementById('login-form').classList.add('hidden');
      document.getElementById('register-form').classList.remove('hidden');
    });

    document.getElementById('show-login').addEventListener('click', () => {
      document.getElementById('register-form').classList.add('hidden');
      document.getElementById('login-form').classList.remove('hidden');
    });
  }

  async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('auth-error');

    if (!email || !password) {
      errorEl.textContent = 'Preencha todos os campos';
      errorEl.classList.remove('hidden');
      return;
    }

    console.log('Tentando login com:', email);
    
    const { data, error } = await signIn(email, password);
    
    console.log('Login result:', { data, error });

    if (error) {
      errorEl.textContent = error.message;
      errorEl.classList.remove('hidden');
    } else {
      currentUser = data.user;
      username = data.user.user_metadata?.username || email.split('@')[0];
      avatarColor = getRandomColor();
      socketId = 'user_' + Math.random().toString(36).substr(2, 9);
      errorEl.classList.add('hidden');
      showApp();
    }
  }

  async function handleRegister() {
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const displayName = document.getElementById('register-username').value.trim();
    const errorEl = document.getElementById('auth-error');

    if (!email || !password || !displayName) {
      errorEl.textContent = 'Preencha todos os campos';
      errorEl.classList.remove('hidden');
      return;
    }

    if (password.length < 6) {
      errorEl.textContent = 'Senha deve ter pelo menos 6 caracteres';
      errorEl.classList.remove('hidden');
      return;
    }

    // Disable email confirmation for demo
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: displayName
        },
        emailRedirectTo: window.location.origin
      }
    });

    if (signupError) {
      errorEl.textContent = signupError.message;
      errorEl.classList.remove('hidden');
    } else {
      // Check if email confirmation is required
      if (signupData.user && !signupData.session) {
        // Email confirmation required
        errorEl.textContent = 'Conta criada! Verifique seu email para confirmar.';
        errorEl.classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
      } else {
        // Auto-login (no confirmation needed)
        currentUser = signupData.user;
        username = displayName;
        avatarColor = getRandomColor();
        socketId = 'user_' + Math.random().toString(36).substr(2, 9);
        errorEl.classList.add('hidden');
        showApp();
      }
    }
  }

  function showApp() {
    document.getElementById('login-modal').classList.remove('active');
    document.getElementById('app').classList.remove('hidden');

    // Update user display
    document.getElementById('user-display-name').textContent = username;
    document.getElementById('user-avatar-letter').textContent = username[0].toUpperCase();
    document.getElementById('user-avatar').style.background = avatarColor;

    // Add logout button
    addLogoutButton();

    // Start app
    startApp();
  }

  function addLogoutButton() {
    const userControls = document.querySelector('.user-controls');
    const existingLogout = document.getElementById('btn-logout');
    if (existingLogout) return;

    const logoutBtn = document.createElement('button');
    logoutBtn.id = 'btn-logout';
    logoutBtn.className = 'user-panel-logout';
    logoutBtn.textContent = 'Sair';
    logoutBtn.title = 'Sair da conta';
    logoutBtn.addEventListener('click', handleLogout);
    userControls.appendChild(logoutBtn);
  }

  async function handleLogout() {
    await signOut();
    location.reload();
  }

  function getRandomColor() {
    const colors = [
      '#7c3aed', '#a855f7', '#6366f1', '#ec4899', '#3b82f6',
      '#06b6d4', '#fbbf24', '#34d399', '#ef4444', '#8b5cf6'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // ========== Continue with original app logic ==========
  // (Reusing the rest of the app logic)

  function startApp() {
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
    setupRealtimeCallbacks();
    setupUIListeners();
    UI.renderServerIcons(SERVERS, activeServerId);
    selectServer(SERVERS[0].id);

    console.log('✅ Conectado ao Supabase Realtime');
    UI.showToast(`Bem-vindo, ${username}!`, 'success');
  }

  function setupRealtimeCallbacks() {
    RealtimeManager.onRoomUsersUpdatedCallback((users) => {
      roomUsers = users;
      renderCurrentVoiceUsers();
      Object.keys(users).forEach(id => {
        if (id !== socketId) {
          WebRTCManager.connectToPeer(id);
        }
      });
    });

    RealtimeManager.onPeerConnectedCallback((peerData) => {
      roomUsers[peerData.socketId] = peerData;
      UI.showToast(`${peerData.username} entrou no canal`, 'info');
      renderCurrentVoiceUsers();
    });

    RealtimeManager.onPeerDisconnectedCallback((peerSocketId) => {
      delete roomUsers[peerSocketId];
      WebRTCManager.closePeer(peerSocketId);
      renderCurrentVoiceUsers();
    });

    RealtimeManager.onOfferCallback(async ({ senderId, offer }) => {
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

    RealtimeManager.onIceCandidateCallback(async ({ senderId, candidate }) => {
      const pc = WebRTCManager.getPeerConnection(senderId);
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Erro ICE:', e);
        }
      }
    });

    RealtimeManager.onScreenShareStartedCallback(({ socketId: sharerId, username: sharerName }) => {
      screenSharers.add(sharerId);
      UI.showToast(`${sharerName} compartilhando tela`, 'info');
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

    RealtimeManager.onSpeakingChangedCallback(({ socketId: sId, isSpeaking }) => {
      speakingStates[sId] = isSpeaking;
      UI.updateSpeakingState(sId, isSpeaking);
    });

    RealtimeManager.onMuteStatusChangedCallback(({ socketId: sId, muted, deafened }) => {
      muteStates[sId] = { muted, deafened };
      renderCurrentVoiceUsers();
    });
  }

  function setupUIListeners() {
    document.getElementById('server-list').addEventListener('click', (e) => {
      const serverIcon = e.target.closest('.server-icon');
      if (!serverIcon) return;
      const serverId = serverIcon.dataset.server;
      if (serverId === 'home') { selectServer(null); return; }
      if (serverId) { selectServer(serverId); }
    });

    document.getElementById('channels-container').addEventListener('click', (e) => {
      const channelItem = e.target.closest('.channel-item');
      if (!channelItem) return;
      const channelId = channelItem.dataset.channelId;
      const channelType = channelItem.dataset.channelType;
      const channelName = channelItem.dataset.channelName;
      if (channelType === 'voice') {
        joinVoiceChannel(channelId, channelName);
      }
    });

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

    document.getElementById('btn-disconnect').addEventListener('click', () => leaveVoiceChannel());
    document.getElementById('btn-quality').addEventListener('click', () => UI.openQualityModal());
    document.getElementById('quality-modal-close').addEventListener('click', () => UI.closeQualityModal());
    document.getElementById('quality-modal').addEventListener('click', (e) => {
      if (e.target.id === 'quality-modal') UI.closeQualityModal();
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
      UI.showToast('Configurações salvas!', 'success');
    });
  }

  function selectServer(serverId) {
    activeServerId = serverId;
    document.querySelectorAll('.server-icon').forEach(icon => {
      icon.classList.toggle('active', icon.dataset.server === (serverId || 'home'));
    });
    if (serverId) {
      const server = SERVERS.find(s => s.id === serverId);
      if (server) { UI.renderChannels(server, activeChannelId, roomsSummary); }
    } else {
      document.getElementById('server-name').textContent = 'AuraVoice';
      document.getElementById('channels-container').innerHTML = `
        <div style="padding: 16px; color: var(--text-muted); text-align: center;">
          <p>Selecione um servidor</p>
        </div>`;
    }
  }

  async function joinVoiceChannel(channelId, channelName) {
    const newRoomId = `${activeServerId}:${channelId}`;
    if (newRoomId === currentRoomId) return;

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

    await RealtimeManager.joinRoom(currentRoomId);
    RealtimeManager.updatePresence({ username, avatarColor, isMuted: localIsMuted, isDeafened: localIsDeafened });
    await WebRTCManager.startMicrophone();

    WebRTCManager.onSpeaking((isSpeaking) => {
      speakingStates[socketId] = isSpeaking;
      UI.updateSpeakingState(socketId, isSpeaking);
      RealtimeManager.sendSpeaking(isSpeaking);
    });

    updateControlButtons();
    UI.showVoiceView(channelName);
    UI.showToast(`Conectado a ${channelName}`, 'success');
  }

  function leaveVoiceChannel() {
    if (!currentRoomId) return;
    if (localIsScreenSharing) {
      WebRTCManager.stopScreenShare();
      localIsScreenSharing = false;
    }
    WebRTCManager.closeAllPeers();
    WebRTCManager.stopMicrophone();
    RealtimeManager.leaveRoom();

    currentRoomId = null;
    activeChannelId = null;
    roomUsers = {};
    speakingStates = {};
    muteStates = {};
    screenSharers.clear();

    UI.hideVoiceView();
    if (activeServerId) {
      const server = SERVERS.find(s => s.id === activeServerId);
      if (server) { UI.renderChannels(server, null, roomsSummary); }
    }
    UI.showToast('Desconectado', 'info');
  }

  function renderCurrentVoiceUsers() {
    if (!currentRoomId || !roomUsers) return;
    UI.renderVoiceUsers(roomUsers, socketId, speakingStates, muteStates, screenSharers);
    document.querySelectorAll('.volume-slider').forEach(slider => {
      const sId = slider.dataset.socketId;
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
