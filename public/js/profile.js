// ============================================
// Profile & Settings Manager
// ============================================

const ProfileManager = (() => {
  let currentProfile = null;
  let currentSettings = null;

  // ========== PROFILE FUNCTIONS ==========

  async function getProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Erro ao buscar perfil:', error);
      return null;
    }
    return data;
  }

  async function getProfileByUsername(username) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();

    if (error) return null;
    return data;
  }

  async function updateProfile(updates) {
    const user = await supabase.auth.getUser();
    if (!user.data.user) return { error: { message: 'Não autenticado' } };

    updates.updated_at = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.data.user.id)
      .select()
      .single();

    if (!error) {
      currentProfile = data;
    }
    return { data, error };
  }

  async function uploadAvatar(file) {
    const user = await supabase.auth.getUser();
    if (!user.data.user) return { error: { message: 'Não autenticado' } };

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.data.user.id}/avatar.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, {
        upsert: true,
        contentType: file.type
      });

    if (uploadError) {
      return { error: uploadError };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    // Update profile with new avatar URL
    const result = await updateProfile({ avatar_url: publicUrl });
    return result;
  }

  async function updateStatus(status, statusText = '') {
    return await updateProfile({ status, status_text: statusText });
  }

  // ========== SETTINGS FUNCTIONS ==========

  async function getSettings() {
    const user = await supabase.auth.getUser();
    if (!user.data.user) return null;

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('id', user.data.user.id)
      .single();

    if (error) {
      console.error('Erro ao buscar settings:', error);
      return null;
    }
    currentSettings = data;
    return data;
  }

  async function saveSettings(updates) {
    const user = await supabase.auth.getUser();
    if (!user.data.user) return { error: { message: 'Não autenticado' } };

    updates.updated_at = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('user_settings')
      .upsert({
        id: user.data.user.id,
        ...updates
      })
      .select()
      .single();

    if (!error) {
      currentSettings = data;
    }
    return { data, error };
  }

  // ========== DEVICES FUNCTIONS ==========

  async function getMediaDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      audioInputs: devices.filter(d => d.kind === 'audioinput'),
      audioOutputs: devices.filter(d => d.kind === 'audiooutput'),
      videoInputs: devices.filter(d => d.kind === 'videoinput')
    };
  }

  // ========== MODAL FUNCTIONS ==========

  function openProfileModal(userId = null) {
    const modal = document.getElementById('profile-modal');
    if (!modal) return;

    loadProfileIntoModal(userId || supabase.auth.getUser()?.data?.user?.id);
    modal.classList.add('active');
  }

  function closeProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (modal) modal.classList.remove('active');
  }

  async function loadProfileIntoModal(userId) {
    const profile = await getProfile(userId);
    if (!profile) return;

    // Avatar
    const avatarImg = document.getElementById('profile-avatar-img');
    const avatarLetter = document.getElementById('profile-avatar-letter');
    const avatarContainer = document.getElementById('profile-avatar-container');
    
    if (profile.avatar_url) {
      avatarImg.src = profile.avatar_url;
      avatarImg.classList.remove('hidden');
      avatarLetter.classList.add('hidden');
    } else {
      avatarImg.classList.add('hidden');
      avatarLetter.classList.remove('hidden');
      avatarLetter.textContent = (profile.username || 'U')[0].toUpperCase();
      avatarContainer.style.background = profile.avatar_color || '#7c3aed';
    }

    // Username
    document.getElementById('profile-username').value = profile.username || '';
    
    // Bio
    document.getElementById('profile-bio').value = profile.bio || '';
    
    // Status
    document.getElementById('profile-status').value = profile.status || 'online';
    
    // Status text
    document.getElementById('profile-status-text').value = profile.status_text || '';

    // Avatar color picker
    document.getElementById('profile-color').value = profile.avatar_color || '#7c3aed';
    avatarContainer.style.background = profile.avatar_color || '#7c3aed';

    // Save userId for editing
    modal.dataset.editUserId = userId;
  }

  async function saveProfileFromModal() {
    const userId = document.getElementById('profile-modal').dataset.editUserId;
    const currentUser = await supabase.auth.getUser();
    
    // Only allow editing own profile
    if (currentUser.data.user.id !== userId) {
      UI.showToast('Você só pode editar seu próprio perfil', 'error');
      return;
    }

    const updates = {
      username: document.getElementById('profile-username').value.trim(),
      bio: document.getElementById('profile-bio').value.trim(),
      status: document.getElementById('profile-status').value,
      status_text: document.getElementById('profile-status-text').value.trim(),
      avatar_color: document.getElementById('profile-color').value
    };

    if (!updates.username) {
      UI.showToast('Nome de usuário é obrigatório', 'error');
      return;
    }

    const { error } = await updateProfile(updates);
    
    if (error) {
      UI.showToast(error.message, 'error');
    } else {
      UI.showToast('Perfil atualizado!', 'success');
      closeProfileModal();
      // Update user panel
      if (typeof window.updateUserPanel === 'function') {
        window.updateUserPanel();
      }
    }
  }

  function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;

    loadSettingsIntoModal();
    modal.classList.add('active');
  }

  function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.remove('active');
  }

  async function loadSettingsIntoModal() {
    const settings = await getSettings();
    if (!settings) return;

    // Audio
    const devices = await getMediaDevices();
    
    // Populate audio input
    const audioInputSelect = document.getElementById('settings-audio-input');
    audioInputSelect.innerHTML = '<option value="default">Padrão</option>' +
      devices.audioInputs.map(d => `<option value="${d.deviceId}" ${settings.audio_input === d.deviceId ? 'selected' : ''}>${d.label || 'Microfone ' + d.deviceId.substr(0, 5)}</option>`).join('');

    // Populate audio output
    const audioOutputSelect = document.getElementById('settings-audio-output');
    audioOutputSelect.innerHTML = '<option value="default">Padrão</option>' +
      devices.audioOutputs.map(d => `<option value="${d.deviceId}" ${settings.audio_output === d.deviceId ? 'selected' : ''}>${d.label || 'Alto-falante ' + d.deviceId.substr(0, 5)}</option>`).join('');

    // Populate video input
    const videoInputSelect = document.getElementById('settings-video-input');
    videoInputSelect.innerHTML = '<option value="default">Nenhum</option>' +
      devices.videoInputs.map(d => `<option value="${d.deviceId}" ${settings.video_input === d.deviceId ? 'selected' : ''}>${d.label || 'Câmera ' + d.deviceId.substr(0, 5)}</option>`).join('');

    // Audio processing
    document.getElementById('settings-noise-suppression').checked = settings.noise_suppression;
    document.getElementById('settings-echo-cancellation').checked = settings.echo_cancellation;

    // Notifications
    document.getElementById('settings-notif-sounds').checked = settings.notifications_sounds;
    document.getElementById('settings-notif-desktop').checked = settings.notifications_desktop;

    // Privacy
    document.getElementById('settings-privacy-calls').checked = settings.privacy_allow_calls;
    document.getElementById('settings-privacy-dms').checked = settings.privacy_allow_dms;
  }

  async function saveSettingsFromModal() {
    const updates = {
      audio_input: document.getElementById('settings-audio-input').value,
      audio_output: document.getElementById('settings-audio-output').value,
      video_input: document.getElementById('settings-video-input').value,
      noise_suppression: document.getElementById('settings-noise-suppression').checked,
      echo_cancellation: document.getElementById('settings-echo-cancellation').checked,
      notifications_sounds: document.getElementById('settings-notif-sounds').checked,
      notifications_desktop: document.getElementById('settings-notif-desktop').checked,
      privacy_allow_calls: document.getElementById('settings-privacy-calls').checked,
      privacy_allow_dms: document.getElementById('settings-privacy-dms').checked
    };

    const { error } = await saveSettings(updates);
    
    if (error) {
      UI.showToast(error.message, 'error');
    } else {
      UI.showToast('Configurações salvas!', 'success');
      closeSettingsModal();
    }
  }

  // ========== AVATAR UPLOAD ==========

  function setupAvatarUpload() {
    const fileInput = document.getElementById('profile-avatar-upload');
    const avatarContainer = document.getElementById('profile-avatar-container');
    
    if (!fileInput || !avatarContainer) return;

    // Click on avatar opens file picker
    avatarContainer.style.cursor = 'pointer';
    avatarContainer.addEventListener('click', () => fileInput.click());

    // Handle file selection
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Validate file type
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
        UI.showToast('Formato inválido. Use JPG, PNG, WebP ou GIF', 'error');
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5242880) {
        UI.showToast('Imagem muito grande. Máximo 5MB', 'error');
        return;
      }

      // Preview immediately
      const reader = new FileReader();
      reader.onload = (e) => {
        document.getElementById('profile-avatar-img').src = e.target.result;
        document.getElementById('profile-avatar-img').classList.remove('hidden');
        document.getElementById('profile-avatar-letter').classList.add('hidden');
      };
      reader.readAsDataURL(file);

      // Upload
      const { error } = await uploadAvatar(file);
      if (error) {
        UI.showToast('Erro ao上传: ' + error.message, 'error');
      } else {
        UI.showToast('Avatar atualizado!', 'success');
      }
    });
  }

  function handleAvatarColorChange(color) {
    const avatarLetter = document.getElementById('profile-avatar-letter');
    const avatarImg = document.getElementById('profile-avatar-img');
    const avatarContainer = document.getElementById('profile-avatar-container');
    
    // Only show letter if no custom image
    if (avatarImg.classList.contains('hidden')) {
      avatarContainer.style.background = color;
    }
  }

  // ========== TAB NAVIGATION ==========

  function setupSettingsTabs() {
    const tabs = document.querySelectorAll('.settings-tab');
    const contents = document.querySelectorAll('.settings-content');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        
        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update active content
        contents.forEach(c => c.classList.remove('active'));
        document.getElementById(`settings-content-${target}`)?.classList.add('active');
      });
    });
  }

  // ========== INIT ==========

  function init() {
    // Profile modal
    document.getElementById('profile-modal-close')?.addEventListener('click', closeProfileModal);
    document.getElementById('profile-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'profile-modal') closeProfileModal();
    });
    document.getElementById('profile-save')?.addEventListener('click', saveProfileFromModal);
    document.getElementById('profile-color')?.addEventListener('input', (e) => handleAvatarColorChange(e.target.value));
    setupAvatarUpload();

    // Settings modal
    document.getElementById('settings-modal-close')?.addEventListener('click', closeSettingsModal);
    document.getElementById('settings-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'settings-modal') closeSettingsModal();
    });
    document.getElementById('settings-save')?.addEventListener('click', saveSettingsFromModal);
    setupSettingsTabs();
  }

  return {
    getProfile,
    getProfileByUsername,
    updateProfile,
    uploadAvatar,
    updateStatus,
    getSettings,
    saveSettings,
    getMediaDevices,
    openProfileModal,
    closeProfileModal,
    openSettingsModal,
    closeSettingsModal,
    init
  };
})();

// Auto-init when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  ProfileManager.init();
});

export const getProfile = ProfileManager.getProfile;
export const updateStatus = ProfileManager.updateStatus;
export default ProfileManager;
