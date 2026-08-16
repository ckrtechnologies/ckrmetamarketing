import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  listConversations, getConversation, sendReply, sendTemplateInChat, startConversation, closeConversation, pollMessages,
} from '../../api/chat.js';
import { listContacts } from '../../api/contacts.js';
import { listWabaAccounts, getWabaTemplates } from '../../api/waba.js';
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
  if (status === 'sent')      return <span className="msg-status">✓</span>;
  if (status === 'delivered') return <span className="msg-status msg-status--delivered">✓✓</span>;
  if (status === 'read')      return <span className="msg-status msg-status--read">✓✓</span>;
  return null;
}

export default function ChatPage({ user }) {
  const [searchParams, setSearchParams] = useSearchParams();

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
  const pollIntervalRef = useRef(null);
  const lastMsgRef      = useRef(null);

  useEffect(() => { loadConversations(); }, [search, statusFilter]);

  // Handle URL query parameters e.g. /chat?phone=917982296878&name=Priya
  useEffect(() => {
    const phoneParam = searchParams.get('phone');
    const nameParam  = searchParams.get('name');
    if (phoneParam) {
      startAndOpenChat(phoneParam, nameParam);
    }
  }, [searchParams]);

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

    // Poll for new messages every 5 seconds
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
    }, 5000);
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
      setMessages(prev => prev.map(m =>
        m.id === optimistic.id ? { ...optimistic, wamid: data.wamid } : m
      ));
      setConversations(prev =>
        prev.map(c => c.id === activeConv.id ? {
          ...c,
          last_message: `You: ${draft.substring(0, 60)}`,
          last_message_at: new Date().toISOString(),
        } : c)
      );
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      if (err.message && (err.message.includes('expired') || err.message.includes('window'))) {
        setWindowExpired(true);
      } else {
        alert('Failed to send: ' + err.message);
      }
      setText(draft);
    } finally {
      setSending(false);
    }
  }

  // Load templates when opening template modal
  async function openTemplateModal() {
    setShowTemplateModal(true);
    try {
      const wabaList = await listWabaAccounts();
      const targetWaba = wabaList.accounts?.[0];
      if (targetWaba) {
        const tplData = await getWabaTemplates(targetWaba.id);
        const approved = (tplData.templates || []).filter(t => ['APPROVED', 'ACTIVE'].includes(t.status?.toUpperCase()));
        setAvailableTemplates(approved);
        if (approved.length > 0) {
          handleSelectTemplate(approved[0]);
        }
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

        <div className="chat-sidebar__search">
          <input
            type="text"
            placeholder="🔍 Search conversations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="chat-sidebar__filter">
          {['', 'open', 'closed'].map(s => (
            <button
              key={s}
              className={`chat-filter-btn${statusFilter === s ? ' chat-filter-btn--active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div className="chat-sidebar__list">
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
            conversations.map(c => {
              const isActive = activeConv?.id === c.id;
              const open = isWindowOpen(c);
              const initial = (c.customer_name || c.customer_phone || 'U').charAt(0).toUpperCase();

              return (
                <div
                  key={c.id}
                  className={`conv-item${isActive ? ' conv-item--active' : ''}`}
                  onClick={() => openConversation(c)}
                >
                  <div className="conv-avatar">{initial}</div>
                  <div className="conv-info">
                    <div className="conv-top">
                      <span className="conv-name">{c.customer_name || formatPhoneDisplay(c.customer_phone)}</span>
                      <span className="conv-time">{timeAgo(c.last_message_at || c.created_at)}</span>
                    </div>
                    <div className="conv-phone">{formatPhoneDisplay(c.customer_phone)}</div>
                    <div className="conv-bottom">
                      <span className="conv-preview">{c.last_message || '—'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        {open && <span className="window-pill window-pill--open">24h</span>}
                        {c.unread_count > 0 && (
                          <span className="conv-badge">{c.unread_count}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Right Pane: Active Chat Window ── */}
      <main className="chat-window">
        {activeConv ? (
          <>
            {/* Top Bar */}
            <div className="chat-window__header">
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
                      🟢 24h Window Open ({windowTimeLeft(activeConv)})
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
              </div>
            </div>

            {/* Expired Window Helper Notice */}
            {!windowOpen && (
              <div className="window-warning-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  ⚠️ <strong>24-hour service window is closed.</strong> Free-form text replies are blocked by WhatsApp rules until the customer replies.
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
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--clr-text-3)', fontSize: 13 }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
                  No messages yet. Send a message or template below.
                </div>
              ) : (
                renderMessages().map((item) => {
                  if (item.type === 'separator') {
                    return (
                      <div key={item.id} className="date-separator">
                        <span>{item.date}</span>
                      </div>
                    );
                  }

                  const isInbound = item.direction === 'inbound';
                  return (
                    <div
                      key={item.id}
                      className={`msg-bubble-wrap ${isInbound ? 'msg-bubble-wrap--inbound' : 'msg-bubble-wrap--outbound'}`}
                    >
                      <div className={`msg-bubble ${isInbound ? 'msg-bubble--inbound' : 'msg-bubble--outbound'}`}>
                        {item.type === 'template' ? (
                          <div className="msg-template-badge">
                            <span style={{ fontSize: 11, fontWeight: 700 }}>📄 {item.body}</span>
                          </div>
                        ) : (
                          <div className="msg-body">{item.body}</div>
                        )}
                        <div className="msg-meta">
                          <span className="msg-time">{formatTime(item.sent_at)}</span>
                          {!isInbound && <MessageStatusIcon status={item.status} />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer Input Area */}
            <div className="chat-composer">
              <input
                type="text"
                className="chat-input"
                placeholder={windowOpen ? "Type a message... (Press Enter to send)" : "Type a message or click 'Send Template'..."}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending}
              />
              <button
                className="chat-send-btn"
                onClick={handleSend}
                disabled={!text.trim() || sending}
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
    </div>
  );
}
