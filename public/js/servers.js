import { supabase } from './supabase.js';

const ServerManager = (() => {
  let cachedServers = [];
  let cachedChannels = {};

  function generateInviteCode() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async function getServers() {
    const { data, error } = await supabase
      .from('servers')
      .select('*, server_members!inner(role)')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar servidores:', error);
      return [];
    }

    cachedServers = data || [];
    return cachedServers;
  }

  async function getServerChannels(serverId) {
    if (cachedChannels[serverId]) return cachedChannels[serverId];

    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .eq('server_id', serverId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Erro ao buscar canais:', error);
      return [];
    }

    const channels = data || [];
    const grouped = {};

    channels.forEach(ch => {
      const cat = ch.category || 'SEM CATEGORIA';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(ch);
    });

    cachedChannels[serverId] = grouped;
    return grouped;
  }

  async function createServer(name, icon = null, color = null) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: 'Não autenticado' } };

    const serverColors = ['#a855f7', '#6366f1', '#ec4899', '#3b82f6', '#06b6d4', '#fbbf24', '#34d399', '#ef4444'];
    const serverColor = color || serverColors[Math.floor(Math.random() * serverColors.length)];

    const { data, error } = await supabase
      .from('servers')
      .insert({
        name,
        icon,
        color: serverColor,
        owner_id: user.id
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar servidor:', error);
      return { error };
    }

    cachedServers = [];
    return { data };
  }

  async function deleteServer(serverId) {
    const { error } = await supabase
      .from('servers')
      .delete()
      .eq('id', serverId);

    if (error) {
      console.error('Erro ao deletar servidor:', error);
      return { error };
    }

    cachedServers = [];
    cachedChannels[serverId] = null;
    return { data: true };
  }

  async function updateServer(serverId, updates) {
    const { data, error } = await supabase
      .from('servers')
      .update(updates)
      .eq('id', serverId)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar servidor:', error);
      return { error };
    }

    cachedServers = [];
    return { data };
  }

  async function getServerMembers(serverId) {
    const { data, error } = await supabase
      .from('server_members')
      .select('*, profiles(username, avatar_url, avatar_color, status, status_text)')
      .eq('server_id', serverId)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar membros:', error);
      return [];
    }

    return data || [];
  }

  async function createInvite(serverId, maxUses = 0, expiresHours = 0) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: 'Não autenticado' } };

    const code = generateInviteCode();
    const expiresAt = expiresHours > 0
      ? new Date(Date.now() + expiresHours * 60 * 60 * 1000).toISOString()
      : null;

    const { data, error } = await supabase
      .from('server_invites')
      .insert({
        server_id: serverId,
        code,
        created_by: user.id,
        max_uses: maxUses,
        expires_at: expiresAt
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar convite:', error);
      return { error };
    }

    return { data };
  }

  async function getInvites(serverId) {
    const { data, error } = await supabase
      .from('server_invites')
      .select('*')
      .eq('server_id', serverId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar convites:', error);
      return [];
    }

    return data || [];
  }

  async function deleteInvite(inviteId) {
    const { error } = await supabase
      .from('server_invites')
      .delete()
      .eq('id', inviteId);

    if (error) {
      console.error('Erro ao deletar convite:', error);
      return { error };
    }

    return { data: true };
  }

  async function joinByInvite(code) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: 'Faça login primeiro' } };

    const { data: invite, error: inviteError } = await supabase
      .from('server_invites')
      .select('*, servers(*)')
      .eq('code', code)
      .single();

    if (inviteError || !invite) {
      return { error: { message: 'Convite inválido' } };
    }

    if (invite.max_uses > 0 && invite.uses >= invite.max_uses) {
      return { error: { message: 'Este convite atingiu o limite de usos' } };
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return { error: { message: 'Este convite expirou' } };
    }

    const { error: memberError } = await supabase
      .from('server_members')
      .insert({
        server_id: invite.server_id,
        user_id: user.id,
        role: 'member'
      });

    if (memberError) {
      if (memberError.code === '23505') {
        return { error: { message: 'Você já é membro deste servidor' } };
      }
      return { error: { message: 'Erro ao entrar no servidor' } };
    }

    await supabase
      .from('server_invites')
      .update({ uses: invite.uses + 1 })
      .eq('id', invite.id);

    cachedServers = [];
    return { data: invite.servers };
  }

  async function removeMember(serverId, userId) {
    const { error } = await supabase
      .from('server_members')
      .delete()
      .eq('server_id', serverId)
      .eq('user_id', userId);

    if (error) {
      console.error('Erro ao remover membro:', error);
      return { error };
    }

    return { data: true };
  }

  async function updateMemberRole(serverId, userId, role) {
    const { data, error } = await supabase
      .from('server_members')
      .update({ role })
      .eq('server_id', serverId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar cargo:', error);
      return { error };
    }

    return { data };
  }

  async function updateMemberNickname(serverId, userId, nickname) {
    const { data, error } = await supabase
      .from('server_members')
      .update({ nickname: nickname || null })
      .eq('server_id', serverId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar nickname:', error);
      return { error };
    }

    return { data };
  }

  async function leaveServer(serverId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: 'Não autenticado' } };

    return await removeMember(serverId, user.id);
  }

  async function createChannel(serverId, name, type, category = '') {
    const { data, error } = await supabase
      .from('channels')
      .insert({
        server_id: serverId,
        name,
        type,
        category,
        position: 0
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar canal:', error);
      return { error };
    }

    cachedChannels[serverId] = null;
    return { data };
  }

  async function deleteChannel(channelId) {
    const { error } = await supabase
      .from('channels')
      .delete()
      .eq('id', channelId);

    if (error) {
      console.error('Erro ao deletar canal:', error);
      return { error };
    }

    cachedChannels = {};
    return { data: true };
  }

  async function getUserRole(serverId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from('server_members')
      .select('role')
      .eq('server_id', serverId)
      .eq('user_id', user.id)
      .single();

    return data ? data.role : null;
  }

  async function isMember(serverId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await supabase
      .from('server_members')
      .select('id')
      .eq('server_id', serverId)
      .eq('user_id', user.id)
      .single();

    return !!data;
  }

  function clearCache() {
    cachedServers = [];
    cachedChannels = {};
  }

  // ========== MESSAGES ==========

  let messageSubscription = null;

  async function getMessages(channelId, limit = 50) {
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles:user_id(username, avatar_url, avatar_color)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Erro ao buscar mensagens:', error);
      return [];
    }
    return (data || []).reverse();
  }

  async function sendMessage(channelId, content) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: 'Não autenticado' } };

    const { data, error } = await supabase
      .from('messages')
      .insert({
        channel_id: channelId,
        user_id: user.id,
        content
      })
      .select('*, profiles:user_id(username, avatar_url, avatar_color)')
      .single();

    if (error) {
      console.error('Erro ao enviar mensagem:', error);
      return { error };
    }
    return { data };
  }

  function subscribeToMessages(channelId, onNewMessage) {
    unsubscribeFromMessages();

    messageSubscription = supabase
      .channel(`messages:${channelId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `channel_id=eq.${channelId}`
      }, async (payload) => {
        // Fetch full message with profile data
        const { data } = await supabase
          .from('messages')
          .select('*, profiles:user_id(username, avatar_url, avatar_color)')
          .eq('id', payload.new.id)
          .single();
        if (data && onNewMessage) onNewMessage(data);
      })
      .subscribe();
  }

  function unsubscribeFromMessages() {
    if (messageSubscription) {
      supabase.removeChannel(messageSubscription);
      messageSubscription = null;
    }
  }

  return {
    getServers,
    getServerChannels,
    createServer,
    deleteServer,
    updateServer,
    getServerMembers,
    createInvite,
    getInvites,
    deleteInvite,
    joinByInvite,
    removeMember,
    updateMemberRole,
    updateMemberNickname,
    leaveServer,
    createChannel,
    deleteChannel,
    getUserRole,
    isMember,
    clearCache,
    getMessages,
    sendMessage,
    subscribeToMessages,
    unsubscribeFromMessages
  };
})();

export default ServerManager;
