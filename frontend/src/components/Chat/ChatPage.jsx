import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  listConversations, getConversation, sendReply, closeConversation, pollMessages,
} from '../../api/chat.js';
import './Chat.css';

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

function isWindowOpen(conv) {
  if (!conv?.window_expires) return false;
  return new Date() < new Date(conv.window_expires);
}

function windowTimeLeft(conv) {
  if (!conv?.window_expires) return null;
  const diff = new Date(conv.window_expires) - new Date();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m left`;
}

function MessageStatusIcon({ status }) {
  if (status === 'sent')      return <span className="msg-status">✓</span>;
  if (status === 'delivered') return <span className="msg-status msg-status--delivered">✓✓</span>;
  if (status === 'read')      return <span className="msg-status msg-status--read">✓✓</span>;
  return null;
}

export default function ChatPage({ user }) {
  const [conversations, setConversations] = useState([]);
  const [total,         setTotal]         = useState(0);
  const [activeConv,    setActiveConv]    = useState(null);
  const [messages,      setMessages]      = useState([]);
  const [text,          setText]          = useState('');
  const [sending,       setSending]       = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [loadingMsgs,   setLoadingMsgs]   = useState(false);
  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState('');
  const [windowExpired, setWindowExpired] = useState(false);

  const messagesEndRef  = useRef(null);
  const pollIntervalRef = useRef(null);
  const lastMsgRef      = useRef(null);

  useEffect(() => { loadConversations(); }, [search, statusFilter]);

  async function loadConversations() {
    try {
      const params = { limit: 50 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const data = await listConversations(params);
      setConversations(data.conversations || []);
      setTotal(data.total || 0);
    } catch (e) {}
    finally { setLoading(false); }
  }

  async function openConversation(conv) {
    setActiveConv(conv);
    setMessages([]);
    setWindowExpired(!isWindowOpen(conv));
    setLoadingMsgs(true);

    clearInterval(pollIntervalRef.current);

    try {
      const data = await getConversation(conv.id);
      setMessages(data.messages || []);
      if (data.messages?.length > 0) {
        lastMsgRef.current = data.messages[data.messages.length - 1].sent_at;
      }
      // Update unread count in sidebar
      setConversations(prev =>
        prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c)
      );
    } catch (e) {}
    finally { setLoadingMsgs(false); }

    // Poll for new messages every 8 seconds
    pollIntervalRef.current = setInterval(async () => {
      try {
        const since = lastMsgRef.current;
        if (!since) return;
        const data = await pollMessages(conv.id, since);
        if (data.messages?.length > 0) {
          setMessages(prev => {
            const ids = new Set(prev.map(m => m.id));
            const newOnes = data.messages.filter(m => !ids.has(m.id));
            if (newOnes.length === 0) return prev;
            lastMsgRef.current = newOnes[newOnes.length - 1].sent_at;
            return [...prev, ...newOnes];
          });
        }
      } catch (e) {}
    }, 3000);
  }

  // Cleanup poll on unmount
  useEffect(() => () => clearInterval(pollIntervalRef.current), []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!text.trim() || !activeConv || sending) return;
    const draft = text;
    setText('');
    setSending(true);

    // Optimistic add
    const optimistic = {
      id: `opt-${Date.now()}`,
      direction: 'outbound',
      type: 'text',
      body: draft,
      status: 'sent',
      sent_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      const data = await sendReply(activeConv.id, draft);
      // Replace optimistic with real
      setMessages(prev => prev.map(m =>
        m.id === optimistic.id ? { ...optimistic, wamid: data.wamid } : m
      ));
      // Update sidebar last_message
      setConversations(prev =>
        prev.map(c => c.id === activeConv.id ? {
          ...c,
          last_message: `You: ${draft.substring(0, 60)}`,
          last_message_at: new Date().toISOString(),
        } : c)
      );
    } catch (err) {
      // Remove optimistic on error
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      if (err.message.includes('expired') || err.message.includes('window')) {
        setWindowExpired(true);
      } else {
        alert('Failed to send: ' + err.message);
      }
      setText(draft);
    } finally {
      setSending(false);
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

  // Group messages by date
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

  const windowOpen = activeConv && isWindowOpen(activeConv);

  return (
    <div className="chat-page fade-in">
      {/* ── Conversation Sidebar ── */}
      <aside className="chat-sidebar">
        <div className="chat-sidebar__header">
          <span className="chat-sidebar__title">💬 Live Chat</span>
          <span className="badge badge--gray">{total}</span>
        </div>

        <div className="chat-sidebar__search">
          <input
            type="text"
            placeholder="🔍 Search conversations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="chat-sidebar__filter">
          {['', 'open', 'closed'].map(f => (
            <button
              key={f}
              className={`chat-filter-btn${statusFilter === f ? ' chat-filter-btn--active' : ''}`}
              onClick={() => setStatusFilter(f)}
            >
              {f === '' ? 'All' : f === 'open' ? '🟢 Open' : '⬜ Closed'}
            </button>
          ))}
        </div>

        <div className="chat-sidebar__list">
          {loading ? (
            <div className="chat-loading"><div className="spinner" /> Loading...</div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--clr-text-3)', fontSize: 13 }}>
              No conversations yet.<br />Customers who message you will appear here.
            </div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                className={`conv-item${activeConv?.id === conv.id ? ' conv-item--active' : ''}`}
                onClick={() => openConversation(conv)}
              >
                <div className="conv-avatar">
                  {(conv.customer_name || conv.customer_phone)?.[0]?.toUpperCase() || '?'}
                  {conv.status === 'open' && conv.unread_count > 0 && (
                    <div className="conv-avatar__online" />
                  )}
                </div>
                <div className="conv-meta">
                  <div className="conv-name">
                    {conv.customer_name || `+${conv.customer_phone}`}
                  </div>
                  <div className="conv-preview">{conv.last_message || 'No messages yet'}</div>
                </div>
                <div className="conv-right">
                  <span className="conv-time">{timeAgo(conv.last_message_at)}</span>
                  {conv.unread_count > 0 && (
                    <span className="conv-unread">{conv.unread_count > 99 ? '99+' : conv.unread_count}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ── Chat Window ── */}
      <div className="chat-window">
        {!activeConv ? (
          <div className="chat-window__empty">
            <div className="chat-window__empty-icon">💬</div>
            <p>Select a conversation to start chatting</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="chat-header">
              <div className="chat-header__info">
                <div className="conv-avatar" style={{ width: 36, height: 36, fontSize: 14 }}>
                  {(activeConv.customer_name || activeConv.customer_phone)?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <div className="chat-header__name">
                    {activeConv.customer_name || `+${activeConv.customer_phone}`}
                  </div>
                  <div className="chat-header__phone">+{activeConv.customer_phone}</div>
                </div>
                <span className={`chat-window-badge ${windowOpen ? 'chat-window-badge--open' : 'chat-window-badge--exp'}`}>
                  {windowOpen ? `⏱ ${windowTimeLeft(activeConv)}` : '🔒 Window Expired'}
                </span>
              </div>
              <div className="chat-header__actions">
                <button className="btn btn--secondary btn--sm" onClick={loadConversations}>↻ Refresh</button>
                {activeConv.status === 'open' && (
                  <button className="btn btn--ghost btn--sm" onClick={handleClose}>Close Chat</button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="chat-messages">
              {loadingMsgs ? (
                <div className="chat-loading"><div className="spinner" /> Loading messages...</div>
              ) : (
                renderMessages().map(item => {
                  if (item.type === 'separator') {
                    return (
                      <div key={item.id} className="msg-date-sep">
                        {new Date(item.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </div>
                    );
                  }
                  const isOut = item.direction === 'outbound';
                  return (
                    <div key={item.id} className={`msg-row${isOut ? ' msg-row--out' : ''}`}>
                      {!isOut && (
                        <div className="msg-avatar">
                          {(activeConv.customer_name || activeConv.customer_phone)?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <div className={`msg-bubble ${isOut ? 'msg-bubble--out' : 'msg-bubble--in'}`}>
                        {item.body}
                        <div className="msg-meta">
                          <span className="msg-time">{formatTime(item.sent_at)}</span>
                          {isOut && <MessageStatusIcon status={item.status} />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="chat-input-area">
              {windowExpired && (
                <div className="chat-window-expired">
                  🔒 24-hour customer service window has expired. You can only send template messages now.
                </div>
              )}
              <div className="chat-input-row">
                <textarea
                  className="chat-input"
                  placeholder={windowExpired ? 'Window expired — cannot send free-form messages' : 'Type a message... (Enter to send)'}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={windowExpired || sending}
                />
                <button
                  className="chat-send-btn"
                  onClick={handleSend}
                  disabled={!text.trim() || windowExpired || sending}
                >
                  {sending ? '⏳' : '➤'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
