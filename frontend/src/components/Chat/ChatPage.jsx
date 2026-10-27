import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  listConversations, getConversation, sendReply, sendMediaReply, sendTemplateInChat, startConversation, closeConversation, deleteConversation, deleteMessage
} from '../../api/chat.js';
import { listContacts, listGroups, listTags } from '../../api/contacts.js';
import { listWabaAccounts, getWabaTemplates } from '../../api/waba.js';
import './Chat.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const SOCKET_URL = API_BASE.replace('/api', '');

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function isWindowOpen(conv, msgs = []) {
  if (conv?.window_expires && new Date() < new Date(conv.window_expires)) {
    return true;
  }
  if (Array.isArray(msgs) && msgs.length > 0) {
    const lastInbound = msgs.slice().reverse().find(m => m.direction === 'inbound');
    if (lastInbound && lastInbound.sent_at) {
      const diff = new Date() - new Date(lastInbound.sent_at);
      if (diff < 24 * 60 * 60 * 1000) return true;
    }
  }
  return false;
}

function windowTimeLeft(conv, msgs = []) {
  let expires = conv?.window_expires ? new Date(conv.window_expires) : null;
  if (!expires && Array.isArray(msgs) && msgs.length > 0) {
    const lastInbound = msgs.slice().reverse().find(m => m.direction === 'inbound');
    if (lastInbound && lastInbound.sent_at) {
      expires = new Date(new Date(lastInbound.sent_at).getTime() + 24 * 60 * 60 * 1000);
    }
  }
  if (!expires) return null;
  const diff = expires - new Date();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m left`;
}

function formatPhoneDisplay(phone) {
  if (!phone) return '—';
  const clean = String(phone).replace(/\D/g, '');
  if (clean.startsWith('91') && clean.length === 12) {
    return `+91 ${clean.slice(2, 7)} ${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  return `+${clean}`;
}

function MessageStatusIcon({ status }) {
  if (status === 'sent')      return <span className="msg-status" style={{color: '#999'}}>✓</span>;
  if (status === 'delivered') return <span className="msg-status" style={{color: '#999'}}>✓✓</span>;
  if (status === 'read')      return <span className="msg-status" style={{color: '#53bdeb'}}>✓✓</span>;
  if (status === 'failed')    return <span className="msg-status" style={{color: 'var(--clr-danger)'}}>✕</span>;
  return null;
}

export default function ChatPage({ user, org }) {
  const orgId = user?.org_id || org?.id;
  const [searchParams, setSearchParams] = useSearchParams();

  const [conversations, setConversations] = useState([]);
  const [wabas,         setWabas]         = useState([]);
  const [groups,        setGroups]        = useState([]);
  const [tags,          setTags]          = useState([]);
  const [total,         setTotal]         = useState(0);
  const [activeConv,    setActiveConv]    = useState(null);
  const [messages,      setMessages]      = useState([]);
  const [text,          setText]          = useState('');
  const [sending,       setSending]       = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [loadingMsgs,   setLoadingMsgs]   = useState(false);

  // Filters State
  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState('');
  const [wabaFilter,    setWabaFilter]    = useState('');
  const [windowFilter,  setWindowFilter]  = useState('');
  const [datePreset,    setDatePreset]    = useState('');
  const [dateFrom,      setDateFrom]      = useState('');
  const [dateTo,        setDateTo]        = useState('');
  const [templateFilter,setTemplateFilter]= useState('');
  const [groupFilter,   setGroupFilter]   = useState('');
  const [tagFilter,     setTagFilter]     = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);

  const [windowExpired, setWindowExpired] = useState(false);

  // Attachments
  const [attachment, setAttachment] = useState(null);
  const fileInputRef = useRef(null);

  // New Chat Modal
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [allContacts,     setAllContacts]     = useState([]);
  const [newChatPhone,    setNewChatPhone]    = useState('');
  const [newChatName,     setNewChatName]     = useState('');

  // Send Template Modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [templateVariables, setTemplateVariables] = useState({});
  const [sendingTemplate, setSendingTemplate] = useState(false);

  const messagesEndRef  = useRef(null);
  const socketRef = useRef(null);
  const activeConvRef = useRef(activeConv);

  useEffect(() => {
    activeConvRef.current = activeConv;
  }, [activeConv]);

  useEffect(() => {
    loadConversations(true);
    loadMetadata();
  }, [
    search,
    statusFilter,
    wabaFilter,
    windowFilter,
    datePreset,
    dateFrom,
    dateTo,
    templateFilter,
    groupFilter,
    tagFilter
  ]);

  async function loadMetadata() {
    try {
      const [wabaData, groupsData, tagsData] = await Promise.allSettled([
        listWabaAccounts(),
        listGroups(),
        listTags(),
      ]);
      if (wabaData.status === 'fulfilled') setWabas(wabaData.value.accounts || []);
      if (groupsData.status === 'fulfilled') setGroups(groupsData.value.groups || []);
      if (tagsData.status === 'fulfilled') setTags(tagsData.value.tags || []);
    } catch (e) {}
  }

  function getFilterParams() {
    const params = {};
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (wabaFilter) params.waba_id = wabaFilter;
    if (windowFilter) params.window_status = windowFilter;
    if (templateFilter) params.template_name = templateFilter;
    if (groupFilter) params.group_id = groupFilter;
    if (tagFilter) params.tag = tagFilter;

    if (datePreset === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      params.date_from = start.toISOString();
    } else if (datePreset === 'yesterday') {
      const start = new Date();
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      params.date_from = start.toISOString();
      params.date_to = end.toISOString();
    } else if (datePreset === 'last7') {
      const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      params.date_from = start.toISOString();
    } else if (datePreset === 'last30') {
      const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      params.date_from = start.toISOString();
    } else if (datePreset === 'custom') {
      if (dateFrom) params.date_from = new Date(dateFrom).toISOString();
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        params.date_to = end.toISOString();
      }
    }
    return params;
  }

  function clearAllFilters() {
    setWabaFilter('');
    setWindowFilter('');
    setDatePreset('');
    setDateFrom('');
    setDateTo('');
    setTemplateFilter('');
    setGroupFilter('');
    setTagFilter('');
  }

  const activeFiltersCount = [
    wabaFilter,
    windowFilter,
    datePreset,
    templateFilter,
    groupFilter,
    tagFilter
  ].filter(Boolean).length;

  // Handle URL query parameters e.g. /chat?phone=917982296878&name=Priya
  useEffect(() => {
    const phoneParam = searchParams.get('phone');
    const nameParam  = searchParams.get('name');
    if (phoneParam) {
      startAndOpenChat(phoneParam, nameParam);
    }
  }, [searchParams]);

  // Setup Socket.io
  useEffect(() => {
    const socket = io(SOCKET_URL || window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (orgId) {
        socket.emit('join_org', orgId);
      }
    });

    socket.on('new_message', (data) => {
      if (!data) return;
      const { conversation_id, message, conversation } = data;
      const currentActive = activeConvRef.current;

      // If we are currently viewing this chat, append it!
      if (currentActive && currentActive.id === conversation_id && message) {
        setMessages(prev => {
          const exists = prev.some(m =>
            (m.id && message.id && m.id === message.id) ||
            (m.wamid && message.wamid && m.wamid === message.wamid)
          );
          if (exists) {
            return prev.map(m =>
              (m.id && message.id && m.id === message.id) || (m.wamid && message.wamid && m.wamid === message.wamid)
                ? { ...m, ...message }
                : m
            );
          }
          return [...prev, message];
        });

        if (message.direction === 'inbound') {
          setWindowExpired(false);
        }
      }

      // Update the conversation list with the latest message snippet and unread count
      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === conversation_id);
        const snippet = (message?.body || '').substring(0, 60);
        const sentAt = message?.sent_at || new Date().toISOString();

        if (idx !== -1) {
          const newConvs = [...prev];
          const updated = {
            ...newConvs[idx],
            last_message: snippet,
            last_message_at: sentAt,
          };
          if (!currentActive || currentActive.id !== conversation_id) {
            updated.unread_count = (updated.unread_count || 0) + 1;
          }
          // Move to top
          newConvs.splice(idx, 1);
          newConvs.unshift(updated);
          return newConvs;
        } else if (conversation) {
          return [conversation, ...prev];
        }
        return prev;
      });
    });

    socket.on('message_status', (data) => {
      if (!data) return;
      const { wamid, status, timestamp } = data;
      setMessages(prev =>
        prev.map(m => (m.wamid === wamid ? { ...m, status, [status + '_at']: timestamp } : m))
      );
    });

    socket.on('message_deleted', (data) => {
      if (!data) return;
      setMessages(prev => prev.filter(m => m.id !== data.message_id));
    });

    socket.on('conversation_deleted', (data) => {
      if (!data) return;
      setConversations(prev => prev.filter(c => c.id !== data.conversation_id));
      if (activeConvRef.current?.id === data.conversation_id) {
        setActiveConv(null);
        setMessages([]);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [orgId]);

  async function loadConversations(reset = false) {
    try {
      if (reset) setLoading(true);
      const params = { limit: 50, offset: 0, ...getFilterParams() };
      const data = await listConversations(params);
      setConversations(data.conversations || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error('[loadConversations]', e);
    } finally {
      if (reset) setLoading(false);
    }
  }

  async function loadMoreConversations() {
    if (loading || loadingMore || conversations.length >= total) return;
    try {
      setLoadingMore(true);
      const params = { limit: 50, offset: conversations.length, ...getFilterParams() };
      const data = await listConversations(params);
      if (data.conversations && data.conversations.length > 0) {
        setConversations(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const nextItems = data.conversations.filter(c => !existingIds.has(c.id));
          return [...prev, ...nextItems];
        });
      }
      if (typeof data.total === 'number') {
        setTotal(data.total);
      }
    } catch (e) {
      console.error('[loadMoreConversations]', e);
    } finally {
      setLoadingMore(false);
    }
  }

  function handleSidebarScroll(e) {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 100) {
      loadMoreConversations();
    }
  }

  async function startAndOpenChat(phone, name) {
    try {
      const res = await startConversation({ customer_phone: phone, customer_name: name });
      if (res.conversation) {
        await loadConversations();
        openConversation(res.conversation);
      }
    } catch (e) {
      console.error('[startAndOpenChat]', e);
    }
  }

  async function openConversation(conv) {
    setActiveConv(conv);
    setMessages([]);
    setWindowExpired(!isWindowOpen(conv));
    setLoadingMsgs(true);
    setAttachment(null);

    try {
      const data = await getConversation(conv.id);
      const msgs = data.messages || [];
      const freshConv = data.conversation ? { ...conv, ...data.conversation } : conv;
      setMessages(msgs);
      setActiveConv(freshConv);
      const open = isWindowOpen(freshConv, msgs);
      setWindowExpired(!open);
      // Update unread count in sidebar
      setConversations(prev =>
        prev.map(c => c.id === conv.id ? { ...c, ...freshConv, unread_count: 0 } : c)
      );
    } catch (e) {}
    finally { setLoadingMsgs(false); }
  }

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, attachment]);

  function handleFileSelect(e) {
    if (e.target.files && e.target.files[0]) {
      setAttachment(e.target.files[0]);
    }
  }

  async function handleSend() {
    if ((!text.trim() && !attachment) || !activeConv || sending) return;
    const draftText = text;
    const file = attachment;
    
    setText('');
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    setSending(true);

    const isMedia = !!file;
    const tempId = `opt-${Date.now()}`;
    let previewBody = draftText;
    
    if (isMedia) {
      let mediaType = 'document';
      if (file.type.startsWith('image/')) mediaType = 'image';
      else if (file.type.startsWith('video/')) mediaType = 'video';
      previewBody = `[${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}: ${draftText || file.name} | URL: local]`;
    }

    // Optimistic add
    const optimistic = {
      id: tempId,
      direction: 'outbound',
      type: isMedia ? (file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document') : 'text',
      body: previewBody,
      status: 'sent',
      sent_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      let data;
      if (isMedia) {
        const formData = new FormData();
        formData.append('file', file);
        if (draftText) formData.append('caption', draftText);
        data = await sendMediaReply(activeConv.id, formData);
        
        // Update optimistic body with real URL
        if (data.mediaLink) {
          const actualType = optimistic.type;
          optimistic.body = `[${actualType.charAt(0).toUpperCase() + actualType.slice(1)}: ${draftText || file.name} | URL: ${data.mediaLink}]`;
        }
      } else {
        data = await sendReply(activeConv.id, draftText);
      }
      
      setMessages(prev => prev.map(m =>
        m.id === tempId ? { ...optimistic, id: data.message?.id || tempId, wamid: data.wamid } : m
      ));
      
      setConversations(prev =>
        prev.map(c => c.id === activeConv.id ? {
          ...c,
          last_message: `You: ${optimistic.body.substring(0, 60)}`,
          last_message_at: new Date().toISOString(),
        } : c)
      );
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      if (err.message && (err.message.includes('expired') || err.message.includes('window'))) {
        setWindowExpired(true);
      } else {
        alert('Failed to send: ' + err.message);
      }
      if (!isMedia) setText(draftText);
    } finally {
      setSending(false);
    }
  }

  // Load templates when opening template modal
  async function openTemplateModal() {
    setShowTemplateModal(true);
    try {
      if (!activeConv?.waba_id) return;
      const tplData = await getWabaTemplates(activeConv.waba_id);
      const approved = (tplData.templates || []).filter(t => ['APPROVED', 'ACTIVE'].includes(t.status?.toUpperCase()));
      setAvailableTemplates(approved);
      if (approved.length > 0) {
        handleSelectTemplate(approved[0]);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function handleSelectTemplate(tpl) {
    setSelectedTemplateName(tpl.name);
    // Extract variables e.g. {{1}}, {{2}}
    const bodyText = tpl.components?.find(c => c.type === 'BODY')?.text || '';
    const matches = bodyText.match(/{{\s*(\d+)\s*}}/g) || [];
    const vars = {};
    matches.forEach(m => {
      const k = m.replace(/[{}]/g, '').trim();
      vars[k] = activeConv?.customer_name || 'Customer';
    });
    setTemplateVariables(vars);
  }

  async function handleSendTemplate(e) {
    e.preventDefault();
    if (!selectedTemplateName || !activeConv) return;
    setSendingTemplate(true);
    try {
      const tpl = availableTemplates.find(t => t.name === selectedTemplateName);
      await sendTemplateInChat(activeConv.id, {
        template_name: selectedTemplateName,
        template_lang: tpl?.language || 'en',
        variables: templateVariables,
      });
      setShowTemplateModal(false);
      // Reload conversation messages
      const data = await getConversation(activeConv.id);
      setMessages(data.messages || []);
      setWindowExpired(false);
    } catch (e) {
      alert(e.message);
    } finally {
      setSendingTemplate(false);
    }
  }

  async function openNewChatDialog() {
    setShowNewChatModal(true);
    try {
      const data = await listContacts({ limit: 100 });
      setAllContacts(data.contacts || []);
    } catch (e) {}
  }

  async function handleStartNewChat(e) {
    e.preventDefault();
    if (!newChatPhone.trim()) return;
    try {
      const res = await startConversation({
        customer_phone: newChatPhone.trim(),
        customer_name: newChatName.trim() || undefined,
      });
      setShowNewChatModal(false);
      setNewChatPhone('');
      setNewChatName('');
      await loadConversations();
      if (res.conversation) {
        openConversation(res.conversation);
      }
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleClose() {
    if (!activeConv || !confirm('Close this conversation?')) return;
    try {
      await closeConversation(activeConv.id);
      setActiveConv(null);
      setMessages([]);
      loadConversations();
    } catch (e) { alert(e.message); }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Parse Media Body format: [Image: caption | URL: https://...]
  function renderMessageBody(msg) {
    if (msg.type === 'template') {
      return <div className="msg-template-badge">📄 {msg.body}</div>;
    }

    if (msg.type === 'image' || msg.type === 'document' || msg.type === 'video') {
      const match = msg.body.match(/\[(.*?):\s*(.*?)\s*\|\s*URL:\s*(.*?)\]/);
      if (match) {
        const [_, type, caption, url] = match;
        if (msg.type === 'image') {
          return (
            <div className="msg-media">
              <img src={url} alt={caption} className="msg-media-img" onClick={() => window.open(url, '_blank')} />
              {caption && <div className="msg-caption">{caption}</div>}
            </div>
          );
        } else if (msg.type === 'document') {
          return (
            <div className="msg-document" onClick={() => window.open(url, '_blank')}>
              <div className="msg-doc-icon">📄</div>
              <div className="msg-doc-info">
                <div className="msg-doc-name">{caption || 'Document'}</div>
                <div className="msg-doc-link">Click to download</div>
              </div>
            </div>
          );
        } else if (msg.type === 'video') {
          return (
            <div className="msg-media">
              <video src={url} controls className="msg-media-video" />
              {caption && <div className="msg-caption">{caption}</div>}
            </div>
          );
        }
      }
    }

    return <div className="msg-body">{msg.body}</div>;
  }

  function renderMessages() {
    const grouped = [];
    let lastDate = null;
    for (const msg of messages) {
      const msgDate = msg.sent_at ? new Date(msg.sent_at).toDateString() : null;
      if (msgDate && msgDate !== lastDate) {
        grouped.push({ type: 'separator', date: msgDate, id: `sep-${msgDate}` });
        lastDate = msgDate;
      }
      grouped.push(msg);
    }
    return grouped;
  }

  const windowOpen = activeConv && isWindowOpen(activeConv, messages);

  return (
    <div className="chat-page fade-in">
      {/* ── Left Pane: Conversation List ── */}
      <aside className="chat-sidebar">
        <div className="chat-sidebar__header">
          <div>
            <div className="chat-sidebar__title">💬 WhatsApp Chats</div>
            <div style={{ fontSize: 11, color: 'var(--clr-text-3)' }}>{total} conversations</div>
          </div>
          <button className="btn btn--primary btn--sm" onClick={openNewChatDialog} title="Start conversation with a phone number">
            + New Chat
          </button>
        </div>

        <div className="chat-sidebar__search-row">
          <div className="chat-sidebar__search">
            <input
              type="text"
              placeholder="🔍 Search name or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            className={`chat-filter-toggle-btn${activeFiltersCount > 0 ? ' chat-filter-toggle-btn--active' : ''}`}
            onClick={() => setShowFilterModal(true)}
            title="Advanced Filters"
          >
            ⚙️ Filters {activeFiltersCount > 0 && <span className="filter-count-badge">{activeFiltersCount}</span>}
          </button>
        </div>

        <div className="chat-sidebar__filter">
          {['', 'unread', 'open', 'closed'].map(s => (
            <button
              key={s}
              className={`chat-filter-btn${statusFilter === s ? ' chat-filter-btn--active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Active Filter Chips Bar */}
        {activeFiltersCount > 0 && (
          <div className="chat-active-filters">
            {wabaFilter && (
              <span className="filter-chip">
                📱 {wabas.find(w => w.id === wabaFilter)?.display_name || 'WABA'}
                <button onClick={() => setWabaFilter('')}>✕</button>
              </span>
            )}
            {windowFilter && (
              <span className="filter-chip">
                {windowFilter === 'open' ? '🟢 24h Open' : '🔴 Closed'}
                <button onClick={() => setWindowFilter('')}>✕</button>
              </span>
            )}
            {datePreset && (
              <span className="filter-chip">
                📅 {datePreset === 'today' ? 'Today' : datePreset === 'yesterday' ? 'Yesterday' : datePreset === 'last7' ? 'Last 7d' : datePreset === 'last30' ? 'Last 30d' : 'Custom Dates'}
                <button onClick={() => { setDatePreset(''); setDateFrom(''); setDateTo(''); }}>✕</button>
              </span>
            )}
            {groupFilter && (
              <span className="filter-chip">
                👥 {groups.find(g => g.id === groupFilter)?.name || 'Group'}
                <button onClick={() => setGroupFilter('')}>✕</button>
              </span>
            )}
            {tagFilter && (
              <span className="filter-chip">
                🏷️ {tagFilter}
                <button onClick={() => setTagFilter('')}>✕</button>
              </span>
            )}
            {templateFilter && (
              <span className="filter-chip">
                📄 {templateFilter}
                <button onClick={() => setTemplateFilter('')}>✕</button>
              </span>
            )}
            <button className="filter-clear-all" onClick={clearAllFilters}>Clear all</button>
          </div>
        )}

        <div className="chat-sidebar__list" onScroll={handleSidebarScroll}>
          {loading ? (
            <div className="loading-center" style={{ padding: 40 }}><div className="spinner" /></div>
          ) : conversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--clr-text-3)', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
              No conversations found.
              <div style={{ marginTop: 10 }}>
                <button className="btn btn--secondary btn--sm" onClick={openNewChatDialog}>+ Start a Chat</button>
              </div>
            </div>
          ) : (
            <>
              {conversations.map(c => {
                const isActive = activeConv?.id === c.id;
                const isUnread = (c.unread_count || 0) > 0;
                const open = isWindowOpen(c);
                const initial = (c.customer_name || c.customer_phone || 'U').charAt(0).toUpperCase();

                return (
                  <div
                    key={c.id}
                    className={`conv-item${isActive ? ' conv-item--active' : ''}${isUnread ? ' conv-item--unread' : ''}`}
                    onClick={() => openConversation(c)}
                  >
                    <div className="conv-avatar">
                      {initial}
                      {isUnread && <span className="conv-avatar__unread-dot" title="Unread messages" />}
                    </div>
                    <div className="conv-info">
                      <div className="conv-top">
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="conv-item__name">
                            {c.customer_name || 'Unknown'}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span className="conv-item__phone">{formatPhoneDisplay(c.customer_phone)}</span>
                            {wabas.length > 1 && c.waba_id && (
                              <span style={{ fontSize: 9, padding: '2px 4px', background: 'rgba(255,255,255,0.1)', borderRadius: 4, color: 'var(--clr-text-2)' }}>
                                {wabas.find(w => w.id === c.waba_id)?.display_name || 'Unknown WABA'}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="conv-time">{timeAgo(c.last_message_at || c.created_at)}</span>
                      </div>
                      <div className="conv-bottom">
                        <span className="conv-preview">{c.last_message || '—'}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          {open && <span className="window-pill window-pill--open">24h</span>}
                          {isUnread && (
                            <span className="conv-badge">{c.unread_count}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {loadingMore && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 0', gap: 8, color: 'var(--clr-text-3)', fontSize: 12 }}>
                  <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  <span>Loading older chats...</span>
                </div>
              )}
              {!loadingMore && conversations.length < total && (
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <button 
                    className="btn btn--ghost btn--sm" 
                    style={{ fontSize: 11, color: 'var(--clr-text-3)' }}
                    onClick={loadMoreConversations}
                  >
                    Load More ({conversations.length} of {total})
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      {/* ── Right Pane: Active Chat Window ── */}
      <main className="chat-window">
        {activeConv ? (
          <>
            {/* Top Bar */}
            <div className="chat-header">
              <div className="chat-header-user">
                <div className="conv-avatar" style={{ width: 38, height: 38, fontSize: 15 }}>
                  {(activeConv.customer_name || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="chat-header-name">
                    {activeConv.customer_name || formatPhoneDisplay(activeConv.customer_phone)}
                  </div>
                  <div className="chat-header-phone">{formatPhoneDisplay(activeConv.customer_phone)}</div>
                </div>
              </div>

              <div className="chat-header-actions">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {windowOpen ? (
                    <span className="window-badge window-badge--open">
                      🟢 24h Window Open ({windowTimeLeft(activeConv, messages)})
                    </span>
                  ) : (
                    <span className="window-badge window-badge--expired">
                      🔴 24h Window Closed
                    </span>
                  )}
                </div>

                <button className="btn btn--secondary btn--sm" onClick={openTemplateModal} title="Send WhatsApp Template Message">
                  📄 Send Template
                </button>

                {activeConv.status === 'open' && (
                  <button className="btn btn--ghost btn--sm" onClick={handleClose}>
                    ✕ Close Chat
                  </button>
                )}
                <button
                  className="btn btn--ghost btn--sm"
                  style={{ color: 'var(--clr-danger)' }}
                  onClick={() => handleDeleteConv(activeConv.id)}
                  title="Delete entire conversation"
                >
                  🗑️ Delete Chat
                </button>
              </div>
            </div>

            {/* Expired Window Helper Notice */}
            {!windowOpen && (
              <div className="window-warning-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  ⚠️ <strong>24-hour service window is closed.</strong> Free-form replies are blocked by WhatsApp rules until the customer replies.
                </div>
                <button className="btn btn--primary btn--sm" style={{ flexShrink: 0, marginLeft: 12 }} onClick={openTemplateModal}>
                  📄 Send Template to Reopen
                </button>
              </div>
            )}

            {/* Messages Area */}
            <div className="chat-messages">
              {loadingMsgs ? (
                <div className="loading-center" style={{ height: '100%' }}><div className="spinner" /></div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--clr-text-3)', fontSize: 13, backgroundColor: 'var(--clr-bg-alt)', borderRadius: 12, margin: 20 }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
                  No messages yet. Send a message or template below.
                </div>
              ) : (
                renderMessages().map((item) => {
                  if (item.type === 'separator') {
                    return (
                      <div key={item.id} className="msg-date-sep">
                        <span>{item.date}</span>
                      </div>
                    );
                  }

                  const isInbound = item.direction === 'inbound';
                  return (
                    <div
                      key={item.id}
                      className={`msg-row ${isInbound ? '' : 'msg-row--out'}`}
                    >
                      <div className={`msg-bubble ${isInbound ? 'msg-bubble--in' : 'msg-bubble--out'} ${item.type !== 'text' ? 'msg-bubble--media' : ''}`}>
                        {renderMessageBody(item)}
                        <div className="msg-meta">
                          <span className="msg-time">{formatTime(item.sent_at)}</span>
                          {!isInbound && <MessageStatusIcon status={item.status} />}
                          <button
                            type="button"
                            className="msg-del-btn"
                            onClick={(e) => { e.stopPropagation(); handleDeleteMsg(item.id); }}
                            title="Delete message from CRM"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {/* Attachment Preview UI */}
              {attachment && (
                <div className="attachment-preview">
                  <div className="attachment-preview-header">
                    <span>📎 Attachment: {attachment.name}</span>
                    <button onClick={() => setAttachment(null)}>✕</button>
                  </div>
                  {attachment.type.startsWith('image/') && (
                    <img src={URL.createObjectURL(attachment)} alt="Preview" style={{maxHeight: 120, borderRadius: 8, marginTop: 8}} />
                  )}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer Input Area */}
            <div className="chat-composer">
              <button 
                className="chat-attach-btn" 
                title="Attach Media"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || !windowOpen}
              >
                📎
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{display: 'none'}} 
                onChange={handleFileSelect}
                accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              />
              
              <input
                type="text"
                className="chat-input"
                placeholder={windowOpen ? "Type a message... (Press Enter to send)" : "24-hour window closed. Send a Template."}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending || !windowOpen}
              />
              <button
                className="chat-send-btn"
                onClick={handleSend}
                disabled={(!text.trim() && !attachment) || sending}
                title="Send Message"
              >
                {sending ? '⏳' : '➤'}
              </button>
            </div>
          </>
        ) : (
          <div className="chat-empty-state">
            <div style={{ fontSize: 54, marginBottom: 14 }}>💬</div>
            <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8, color: 'var(--clr-text)' }}>
              WhatsApp Live Messenger
            </h2>
            <p style={{ color: 'var(--clr-text-2)', maxWidth: 400, margin: '0 auto 20px', lineHeight: 1.5 }}>
              Select a conversation from the left sidebar or start a new chat with any customer.
            </p>
            <button className="btn btn--primary" onClick={openNewChatDialog}>
              + Start New Conversation
            </button>
          </div>
        )}
      </main>

      {/* ── Modal: New Chat ── */}
      {showNewChatModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowNewChatModal(false)}>
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <div className="modal-title">💬 Start WhatsApp Chat</div>
            <form onSubmit={handleStartNewChat} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {allContacts.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Pick Existing Contact (Optional)</label>
                  <select
                    className="form-input"
                    onChange={e => {
                      const c = allContacts.find(x => x.id === e.target.value);
                      if (c) {
                        setNewChatPhone(c.phone);
                        setNewChatName(c.name || '');
                      }
                    }}
                  >
                    <option value="">Choose from contacts...</option>
                    {allContacts.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name ? `${c.name} (${formatPhoneDisplay(c.phone)})` : formatPhoneDisplay(c.phone)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Customer Phone Number *</label>
                <input
                  className="form-input"
                  placeholder="e.g. 7982296878 or +91 79822 96878"
                  value={newChatPhone}
                  onChange={e => setNewChatPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Customer Name</label>
                <input
                  className="form-input"
                  placeholder="e.g. Priya Patel"
                  value={newChatName}
                  onChange={e => setNewChatName(e.target.value)}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn--ghost" onClick={() => setShowNewChatModal(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary">
                  Open Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Send Template Message ── */}
      {showTemplateModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowTemplateModal(false)}>
          <div className="modal-box" style={{ maxWidth: 540 }}>
            <div className="modal-title">📄 Send WhatsApp Template</div>
            <form onSubmit={handleSendTemplate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Select Template *</label>
                <select
                  className="form-input"
                  value={selectedTemplateName}
                  onChange={e => {
                    const t = availableTemplates.find(x => x.name === e.target.value);
                    if (t) handleSelectTemplate(t);
                  }}
                  required
                >
                  {availableTemplates.map(t => (
                    <option key={t.id} value={t.name}>{t.name} ({t.language})</option>
                  ))}
                </select>
              </div>

              {/* Template variables */}
              {Object.keys(templateVariables).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--clr-primary)' }}>
                    Fill Template Parameters:
                  </div>
                  {Object.keys(templateVariables).map(v => (
                    <div key={v} className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Parameter &#123;&#123;{v}&#125;&#125;:</label>
                      <input
                        className="form-input"
                        value={templateVariables[v] || ''}
                        onChange={e => setTemplateVariables(prev => ({ ...prev, [v]: e.target.value }))}
                        required
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn--ghost" onClick={() => setShowTemplateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={sendingTemplate || !selectedTemplateName}>
                  {sendingTemplate ? 'Sending Template...' : '🚀 Send Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Advanced Chat Filters ── */}
      {showFilterModal && (
        <div className="modal-overlay" onClick={() => setShowFilterModal(false)}>
          <div className="modal-box filter-modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div className="modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🔍</span> Filter Conversations
              </div>
              <button className="btn btn--ghost btn--sm" onClick={() => setShowFilterModal(false)}>✕</button>
            </div>

            <div className="filter-modal-body">
              {/* WhatsApp Number (WABA) */}
              {wabas.length > 1 && (
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">📱 WhatsApp Number (WABA)</label>
                  <select
                    className="form-input"
                    value={wabaFilter}
                    onChange={e => setWabaFilter(e.target.value)}
                  >
                    <option value="">All WhatsApp Numbers</option>
                    {wabas.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.display_name || w.display_number} ({w.display_number})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 24-Hour Service Window */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">⏱️ 24-Hour Service Window</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { val: '', label: 'All' },
                    { val: 'open', label: '🟢 24h Open' },
                    { val: 'expired', label: '🔴 Closed' },
                  ].map(item => (
                    <button
                      key={item.val}
                      type="button"
                      className={`btn btn--sm ${windowFilter === item.val ? 'btn--primary' : 'btn--secondary'}`}
                      onClick={() => setWindowFilter(item.val)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Activity / Date Range */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">📅 Activity Date Range</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {[
                    { val: '', label: 'Any time' },
                    { val: 'today', label: 'Today' },
                    { val: 'yesterday', label: 'Yesterday' },
                    { val: 'last7', label: 'Last 7 Days' },
                    { val: 'last30', label: 'Last 30 Days' },
                    { val: 'custom', label: 'Custom' },
                  ].map(item => (
                    <button
                      key={item.val}
                      type="button"
                      className={`chat-filter-btn ${datePreset === item.val ? 'chat-filter-btn--active' : ''}`}
                      onClick={() => setDatePreset(item.val)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {datePreset === 'custom' && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 11, color: 'var(--clr-text-3)' }}>From:</span>
                      <input
                        type="date"
                        className="form-input"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 11, color: 'var(--clr-text-3)' }}>To:</span>
                      <input
                        type="date"
                        className="form-input"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Contact Groups & Tags */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">👥 Contact Group</label>
                  <select
                    className="form-input"
                    value={groupFilter}
                    onChange={e => setGroupFilter(e.target.value)}
                  >
                    <option value="">All Contact Groups</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">🏷️ Contact Tag</label>
                  <select
                    className="form-input"
                    value={tagFilter}
                    onChange={e => setTagFilter(e.target.value)}
                  >
                    <option value="">All Tags</option>
                    {tags.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Campaign / Template Name */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">📄 Campaign / Template Source</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. rishabh_school_marketing"
                  value={templateFilter}
                  onChange={e => setTemplateFilter(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={clearAllFilters}
              >
                Reset All Filters
              </button>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => setShowFilterModal(false)}
              >
                Apply Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
