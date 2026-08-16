import React from 'react';

export default function Dashboard({ user, org }) {
  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>👋 Welcome, {user?.name?.split(' ')[0] || 'there'}!</h1>
          <p>Here's an overview of your WhatsApp campaign activity.</p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-card__label">Total Campaigns</div>
          <div className="stat-card__value" style={{ color: 'var(--clr-primary)' }}>0</div>
          <div className="stat-card__sub">All time</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Messages Sent</div>
          <div className="stat-card__value">0</div>
          <div className="stat-card__sub">This month</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Delivered</div>
          <div className="stat-card__value" style={{ color: '#22c55e' }}>0%</div>
          <div className="stat-card__sub">Delivery rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Live Chats</div>
          <div className="stat-card__value" style={{ color: '#6366f1' }}>0</div>
          <div className="stat-card__sub">Open conversations</div>
        </div>
      </div>

      <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🚀</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 8 }}>
          Get Started
        </h2>
        <p style={{ color: 'var(--clr-text-2)', marginBottom: 20, maxWidth: 360, margin: '0 auto 20px' }}>
          Connect your WhatsApp Business number to start sending campaigns.
        </p>
        <a href="/waba" className="btn btn--primary btn--lg">📱 Connect WhatsApp Number</a>
      </div>
    </div>
  );
}
