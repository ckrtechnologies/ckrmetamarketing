import React from 'react';

export default function WhatsAppPreview({
  name = 'Template Preview',
  headerType = 'NONE',
  headerText = '',
  bodyText = '',
  footerText = '',
  buttons = [],
  variables = {},
}) {
  // Replace {{1}}, {{2}} with sample values if provided
  function renderBody() {
    if (!bodyText) {
      return <span style={{ color: '#8696a0', fontStyle: 'italic' }}>Your message text will appear here...</span>;
    }

    const parts = bodyText.split(/({{\s*\d+\s*}})/g);
    return parts.map((part, i) => {
      const match = part.match(/{{\s*(\d+)\s*}}/);
      if (match) {
        const varNum = match[1];
        const val = variables[varNum] || `{{${varNum}}}`;
        return (
          <span key={i} className="wa-bubble-var">
            {val}
          </span>
        );
      }
      return part;
    });
  }

  return (
    <div className="wa-phone-frame">
      <div className="wa-phone-notch">
        <div className="wa-phone-notch-bar" />
      </div>

      <div className="wa-phone-header">
        <div className="wa-phone-avatar">W</div>
        <div>
          <div className="wa-phone-chat-title">
            Your Business
            <span style={{ color: '#25d366', fontSize: 12 }}>✓</span>
          </div>
          <div style={{ fontSize: 10.5, color: '#8696a0' }}>WhatsApp Business Account</div>
        </div>
      </div>

      <div className="wa-phone-screen">
        <div className="wa-bubble-container">
          <div className="wa-bubble">
            {/* Header */}
            {headerType === 'TEXT' && headerText && (
              <div className="wa-bubble-header-text">{headerText}</div>
            )}
            {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && (
              <div className="wa-bubble-header-media">
                {headerType === 'IMAGE' && '🖼️ Media Header [Image]'}
                {headerType === 'VIDEO' && '🎥 Media Header [Video]'}
                {headerType === 'DOCUMENT' && '📄 Media Header [PDF/Doc]'}
              </div>
            )}

            {/* Body */}
            <div className="wa-bubble-body">{renderBody()}</div>

            {/* Footer */}
            {footerText && <div className="wa-bubble-footer">{footerText}</div>}

            {/* Timestamp */}
            <div className="wa-bubble-meta">
              <span>{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>

          {/* Buttons */}
          {buttons && buttons.length > 0 && (
            <div style={{ marginTop: 2 }}>
              {buttons.map((btn, idx) => (
                <div key={idx} className="wa-bubble-btn">
                  {btn.type === 'PHONE_NUMBER' && '📞 '}
                  {btn.type === 'URL' && '🔗 '}
                  {btn.type === 'QUICK_REPLY' && '💬 '}
                  {btn.text || 'Button Text'}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
