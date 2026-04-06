// ============================================
// UI Helper Module
// ============================================

window.UI = (() => {
  // SVG icons
  const ICONS = {
    voiceChannel: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 0 0-9 9 9 9 0 0 0 9 9 9 9 0 0 0 9-9 9 9 0 0 0-9-9zm0 16a7 7 0 0 1-7-7 7 7 0 0 1 7-7 7 7 0 0 1 7 7 7 7 0 0 1-7 7zm-1-11.5v9l7-4.5-7-4.5z"/></svg>`,
    textChannel: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M5.88 21l1.54-6H3l.49-2h4.42l1.46-6H5l.49-2h4.42L11.37 1h2.06l-1.46 4H16.4l1.46-4h2.06l-1.46 4H23l-.49 2h-4.42l-1.46 6H21l-.49 2h-4.42L14.63 19h-2.06l1.46-4H9.6l-1.46 4H6.08zM9.97 7l-1.46 6h4.42l1.46-6H9.97z"/></svg>`,
    muted: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/></svg>`,
    deafened: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4.34 2.93L2.93 4.34 7.29 8.7 7 9H3v6h4l5 5V13.41l4.06 4.06c-.63.5-1.32.87-2.06 1.11v2.06c1.13-.31 2.15-.87 3.03-1.61l2.63 2.63 1.41-1.41L4.34 2.93zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zm-7-8l-1.88 1.88L12 7.76zm4.5 8c0-1.77-1.02-3.29-2.5-4.03v1.79l2.48 2.48c.01-.08.02-.16.02-.24z"/></svg>`,
    screen: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/></svg>`,
  };

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    let iconSvg;
    switch (type) {
      case 'success':
        iconSvg = `<svg class="toast-icon success" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`;
        break;
      case 'error':
        iconSvg = `<svg class="toast-icon error" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>`;
        break;
      default:
        iconSvg = `<svg class="toast-icon info" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`;
    }

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function renderServerIcons(servers, activeServerId) {
    const container = document.getElementById('server-icons');
    container.innerHTML = '';

    servers.forEach(server => {
      const icon = document.createElement('div');
      icon.className = `server-icon ${server.id === activeServerId ? 'active' : ''}`;
      icon.dataset.server = server.id;
      icon.title = server.name;

      const initials = server.name
        .split(' ')
        .map(w => w[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

      icon.innerHTML = `<span class="server-avatar" style="background: ${server.color || 'var(--blurple)'}">${server.icon || initials}</span>`;
      container.appendChild(icon);
    });
  }

  // Web Audio API Synthesizer for SFX
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  function playSFX(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    
    if (type === 'join') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.5, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'leave') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.15);
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.5, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  }

  function renderChannelsFromDB(server, channelsGrouped, activeChannelId, roomsSummary) {
    const container = document.getElementById('channels-container');
    const serverName = document.getElementById('server-name');
    serverName.textContent = server.name;
    container.innerHTML = '';

    Object.entries(channelsGrouped).forEach(([categoryName, channels]) => {
      const catEl = document.createElement('div');
      catEl.className = 'channel-category';

      catEl.innerHTML = `
        <div class="category-header">
          <svg class="category-arrow" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
          <span class="category-name">${categoryName}</span>
        </div>
      `;

      channels.forEach(channel => {
        const isVoice = channel.type === 'voice';
        const roomId = `${server.id}:${channel.id}`;
        const roomData = roomsSummary[roomId];
        const userCount = roomData ? roomData.count : 0;
        const isActive = channel.id === activeChannelId;

        const chEl = document.createElement('div');
        chEl.className = `channel-item ${isActive ? 'active' : ''}`;
        chEl.dataset.channelId = channel.id;
        chEl.dataset.channelType = channel.type;
        chEl.dataset.channelName = channel.name;

        chEl.innerHTML = `
          <span class="channel-icon">${isVoice ? ICONS.voiceChannel : ICONS.textChannel}</span>
          <span class="channel-name">${channel.name}</span>
          ${isVoice && userCount > 0 ? `<span class="channel-user-count">${userCount}</span>` : ''}
        `;

        catEl.appendChild(chEl);

        if (isVoice && roomData && roomData.users && roomData.users.length > 0) {
          const usersContainer = document.createElement('div');
          usersContainer.className = 'channel-voice-users';

          roomData.users.forEach(user => {
            const userEl = document.createElement('div');
            userEl.className = 'channel-voice-user';
            userEl.dataset.socketId = user.socketId;
            userEl.innerHTML = `
              <div class="mini-avatar" style="background: ${user.avatarColor}">${user.username[0].toUpperCase()}</div>
              <span class="mini-username">${user.username}</span>
              <div class="user-icons"></div>
            `;
            usersContainer.appendChild(userEl);
          });

          catEl.appendChild(usersContainer);
        }
      });

      container.appendChild(catEl);
    });
  }

  function renderChannels(server, activeChannelId, roomsSummary) {
    const container = document.getElementById('channels-container');
    const serverName = document.getElementById('server-name');
    serverName.textContent = server.name;
    container.innerHTML = '';

    server.categories.forEach(category => {
      const catEl = document.createElement('div');
      catEl.className = 'channel-category';

      catEl.innerHTML = `
        <div class="category-header">
          <svg class="category-arrow" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
          <span class="category-name">${category.name}</span>
        </div>
      `;

      category.channels.forEach(channel => {
        const isVoice = channel.type === 'voice';
        const roomId = `${server.id}:${channel.id}`;
        const roomData = roomsSummary[roomId];
        const userCount = roomData ? roomData.count : 0;
        const isActive = channel.id === activeChannelId;

        const chEl = document.createElement('div');
        chEl.className = `channel-item ${isActive ? 'active' : ''}`;
        chEl.dataset.channelId = channel.id;
        chEl.dataset.channelType = channel.type;
        chEl.dataset.channelName = channel.name;

        chEl.innerHTML = `
          <span class="channel-icon">${isVoice ? ICONS.voiceChannel : ICONS.textChannel}</span>
          <span class="channel-name">${channel.name}</span>
          ${isVoice && userCount > 0 ? `<span class="channel-user-count">${userCount}</span>` : ''}
        `;

        catEl.appendChild(chEl);

        // Show users in voice channel
        if (isVoice && roomData && roomData.users && roomData.users.length > 0) {
          const usersContainer = document.createElement('div');
          usersContainer.className = 'channel-voice-users';

          roomData.users.forEach(user => {
            const userEl = document.createElement('div');
            userEl.className = 'channel-voice-user';
            userEl.dataset.socketId = user.socketId;
            userEl.innerHTML = `
              <div class="mini-avatar" style="background: ${user.avatarColor}">${user.username[0].toUpperCase()}</div>
              <span class="mini-username">${user.username}</span>
              <div class="user-icons"></div>
            `;
            usersContainer.appendChild(userEl);
          });

          catEl.appendChild(usersContainer);
        }
      });

      container.appendChild(catEl);
    });
  }

  function renderVoiceUsers(users, localSocketId, speakingStates, muteStates, screenSharers) {
    const grid = document.getElementById('voice-users-grid');
    grid.innerHTML = '';

    Object.entries(users).forEach(([socketId, userData]) => {
      const tile = document.createElement('div');
      const isSelf = socketId === localSocketId;
      const isSpeaking = speakingStates[socketId] || false;
      const muteState = muteStates[socketId] || { muted: false, deafened: false };
      const isScreenSharing = screenSharers.has(socketId);

      tile.className = `voice-user-tile ${isSelf ? 'self' : ''} ${isSpeaking ? 'speaking' : ''}`;
      tile.dataset.socketId = socketId;

      let iconsHtml = '';
      if (muteState.muted) iconsHtml += `<span class="icon-muted">${ICONS.muted}</span>`;
      if (muteState.deafened) iconsHtml += `<span class="icon-muted">${ICONS.deafened}</span>`;
      if (isScreenSharing) iconsHtml += `<span class="icon-screen">${ICONS.screen}</span>`;

tile.innerHTML = `
        <div class="tile-icons">${iconsHtml}</div>
        <div class="tile-avatar" style="background: ${userData.avatarColor || 'var(--cosmic-primary)'}">
          ${(userData.username || 'U')[0].toUpperCase()}
        </div>
        <div class="tile-username">${userData.username || 'Usuário'}</div>
        ${!isSelf ? `
        <div class="volume-slider-container">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
          </svg>
          <input type="range" class="volume-slider" min="0" max="100" value="100" data-socket-id="${socketId}">
        </div>
        ` : ''}
      `;

      grid.appendChild(tile);
    });
  }

  function updateSpeakingState(socketId, isSpeaking) {
    // Update tile
    const tile = document.querySelector(`.voice-user-tile[data-socket-id="${socketId}"]`);
    if (tile) {
      tile.classList.toggle('speaking', isSpeaking);
    }

    // Update sidebar user
    const sidebarUser = document.querySelector(`.channel-voice-user[data-socket-id="${socketId}"]`);
    if (sidebarUser) {
      sidebarUser.classList.toggle('speaking', isSpeaking);
    }
  }

  function showVoiceView(channelName) {
    document.getElementById('welcome-screen').classList.add('hidden');
    document.getElementById('voice-view').classList.remove('hidden');
    document.getElementById('voice-channel-name').textContent = channelName;
  }

  function hideVoiceView() {
    document.getElementById('voice-view').classList.add('hidden');
    document.getElementById('welcome-screen').classList.remove('hidden');
    removeScreenShareStream();
  }

  function removeScreenShareStream(socketId) {
    const area = document.getElementById('screen-share-area');
    const container = document.getElementById('screen-share-container');
    const grid = document.getElementById('voice-users-grid');

    if (socketId) {
      const wrapper = document.getElementById(`screen-share-wrapper-${socketId}`);
      if (wrapper) wrapper.remove();
    } else {
      container.innerHTML = '';
    }

    if (container.children.length === 0) {
      area.classList.add('hidden');
      grid.classList.remove('compact');
    }
  }

  function setScreenShareStream(socketId, stream, username) {
    const area = document.getElementById('screen-share-area');
    const container = document.getElementById('screen-share-container');
    const grid = document.getElementById('voice-users-grid');

    let wrapper = document.getElementById(`screen-share-wrapper-${socketId}`);
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = `screen-share-wrapper-${socketId}`;
      wrapper.className = 'screen-share-wrapper';
      
      wrapper.innerHTML = `
        <div class="screen-share-label">
          <span class="screen-share-dot"></span>
          <span>${username}</span>
        </div>
        <video autoplay playsinline></video>
      `;
      container.appendChild(wrapper);
    } else {
      wrapper.querySelector('.screen-share-label span:nth-child(2)').textContent = username;
    }

    const video = wrapper.querySelector('video');
    video.srcObject = stream;

    area.classList.remove('hidden');
    grid.classList.add('compact');
  }

  function openQualityModal() {
    console.log('🎛️ Opening quality modal...');
    const modal = document.getElementById('quality-modal');
    modal.classList.add('active');
  }

  function closeQualityModal() {
    console.log('🎛️ Closing quality modal...');
    const modal = document.getElementById('quality-modal');
    modal.classList.remove('active');
  }

  return {
    ICONS,
    showToast,
    renderServerIcons,
    renderChannelsFromDB,
    renderChannels,
    renderVoiceUsers,
    updateSpeakingState,
    showVoiceView,
    hideVoiceView,
    removeScreenShareStream,
    setScreenShareStream,
    openQualityModal,
    closeQualityModal,
    playSFX
  };
})();
