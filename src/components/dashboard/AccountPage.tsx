import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { colors } from '../../config/theme';
import { useAccentColor } from '../../hooks/useAccentColor';
import { Key, Eye, EyeOff, LogOut, Gift, Calendar, Shield, ArrowLeft, Copy, Check } from 'lucide-react';

interface AccountInfo {
  key: string;
  expiresAt: string | null;
}

interface AccountPageProps {
  onBack: () => void;
}

export function AccountPage({ onBack }: AccountPageProps) {
  const accent = useAccentColor();
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFullKey, setShowFullKey] = useState(false);
  const [redeemKey, setRedeemKey] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copied, setCopied] = useState(false);
  const [redeemFocused, setRedeemFocused] = useState(false);

  const loadAccountInfo = async () => {
    setLoading(true);
    try {
      const info = await invoke<AccountInfo>('get_account_info');
      setAccountInfo(info);
    } catch {
      setAccountInfo(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAccountInfo();
  }, []);

  const showStatus = (text: string, type: 'success' | 'error') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return '****';
    return key.slice(0, 4) + '\u2022'.repeat(Math.min(key.length - 8, 24)) + key.slice(-4);
  };

  const handleCopyKey = async () => {
    if (!accountInfo) return;
    await navigator.clipboard.writeText(accountInfo.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRedeem = async () => {
    if (!redeemKey.trim() || redeemLoading) return;
    setRedeemLoading(true);
    try {
      await invoke('redeem_license', { license: redeemKey.trim() });
      showStatus('License redeemed successfully', 'success');
      setRedeemKey('');
      loadAccountInfo();
    } catch (e: any) {
      showStatus(e?.toString() || 'Failed to redeem license', 'error');
    }
    setRedeemLoading(false);
  };

  const handleResetHwid = async () => {
    if (resetLoading) return;
    setResetLoading(true);
    try {
      const result = await invoke<string>('reset_hwid');
      showStatus(result, 'success');
    } catch (e: any) {
      showStatus(e?.toString() || 'Failed to reset HWID', 'error');
    }
    setResetLoading(false);
  };

  const handleLogout = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    try {
      await invoke('logout_account');
      showStatus('Logged out successfully', 'success');
      setAccountInfo(null);
    } catch (e: any) {
      showStatus(e?.toString() || 'Failed to log out', 'error');
    }
    setLogoutLoading(false);
  };

  const formatExpiry = (dateStr: string | null) => {
    if (!dateStr) return 'Unknown';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = date.getTime() - now.getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

      const formatted = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      if (days <= 0) return `Expired (${formatted})`;
      if (days === 1) return `${formatted} (1 day left)`;
      return `${formatted} (${days} days left)`;
    } catch {
      return 'Unknown';
    }
  };

  const getExpiryColor = (dateStr: string | null) => {
    if (!dateStr) return colors.textMuted;
    try {
      const diff = new Date(dateStr).getTime() - Date.now();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      if (days <= 0) return colors.error;
      if (days <= 7) return '#FFA726';
      return colors.success;
    } catch {
      return colors.textMuted;
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: colors.bgDark,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '20px 28px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          onClick={onBack}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'rgba(255,255,255,0.03)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
        >
          <ArrowLeft size={14} color={colors.textMuted} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: colors.textWhite }}>Account</div>
          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
            Manage your license and account settings
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {statusMessage && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: statusMessage.type === 'success' ? `${colors.success}12` : `${colors.error}12`,
              border: `1px solid ${statusMessage.type === 'success' ? colors.success : colors.error}25`,
              color: statusMessage.type === 'success' ? colors.success : colors.error,
              fontSize: 12,
              fontWeight: 500,
              animation: 'fadeIn 0.2s ease',
            }}
          >
            {statusMessage.text}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: colors.textMuted, fontSize: 13 }}>
            Loading account info...
          </div>
        ) : !accountInfo ? (
          <div
            style={{
              textAlign: 'center',
              padding: 40,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: `${colors.error}10`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <Key size={24} color={colors.error} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: colors.textWhite, marginBottom: 6 }}>
              No Account Found
            </div>
            <div style={{ fontSize: 12, color: colors.textMuted }}>
              No license key detected on this machine
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 14,
                padding: '18px 20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Key size={14} color={accent.primary} />
                <span style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  License Key
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: 8,
                    fontFamily: 'monospace',
                    fontSize: 13,
                    color: colors.textWhite,
                    letterSpacing: '0.02em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    userSelect: showFullKey ? 'text' : 'none',
                  }}
                >
                  {showFullKey ? accountInfo.key : maskKey(accountInfo.key)}
                </div>
                <div
                  onClick={() => setShowFullKey(!showFullKey)}
                  title={showFullKey ? 'Hide key' : 'Show full key'}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                >
                  {showFullKey ? <EyeOff size={14} color={colors.textMuted} /> : <Eye size={14} color={colors.textMuted} />}
                </div>
                <div
                  onClick={handleCopyKey}
                  title="Copy key"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: copied ? `${colors.success}15` : 'rgba(255,255,255,0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (!copied) e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    if (!copied) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  }}
                >
                  {copied ? <Check size={14} color={colors.success} /> : <Copy size={14} color={colors.textMuted} />}
                </div>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 14,
                padding: '18px 20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Calendar size={14} color={accent.primary} />
                <span style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Expiration
                </span>
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: getExpiryColor(accountInfo.expiresAt),
                }}
              >
                {formatExpiry(accountInfo.expiresAt)}
              </div>
            </div>

            <div
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 14,
                padding: '18px 20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Gift size={14} color={accent.primary} />
                <span style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Redeem License
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Enter license key..."
                  value={redeemKey}
                  onChange={(e) => setRedeemKey(e.target.value)}
                  onFocus={() => setRedeemFocused(true)}
                  onBlur={() => setRedeemFocused(false)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    background: 'rgba(0,0,0,0.3)',
                    border: `1px solid ${redeemFocused ? accent.primary + '40' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 8,
                    outline: 'none',
                    fontSize: 12,
                    color: colors.textWhite,
                    transition: 'border-color 0.15s ease',
                  }}
                />
                <div
                  onClick={handleRedeem}
                  style={{
                    padding: '10px 18px',
                    background: redeemLoading ? 'rgba(255,255,255,0.03)' : `${accent.primary}18`,
                    border: `1px solid ${accent.primary}30`,
                    borderRadius: 8,
                    cursor: redeemLoading ? 'default' : 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                    color: accent.primary,
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                    opacity: redeemLoading ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!redeemLoading) e.currentTarget.style.background = `${accent.primary}25`;
                  }}
                  onMouseLeave={(e) => {
                    if (!redeemLoading) e.currentTarget.style.background = `${accent.primary}18`;
                  }}
                >
                  {redeemLoading ? 'Redeeming...' : 'Redeem'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <div
                onClick={handleResetHwid}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 12,
                  cursor: resetLoading ? 'default' : 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  color: colors.textMuted,
                  transition: 'all 0.15s ease',
                  opacity: resetLoading ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!resetLoading) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                    e.currentTarget.style.color = colors.textWhite;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!resetLoading) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                    e.currentTarget.style.color = colors.textMuted;
                  }
                }}
              >
                <Shield size={14} />
                {resetLoading ? 'Resetting...' : 'Reset HWID'}
              </div>

              <div
                onClick={handleLogout}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 16px',
                  background: `${colors.error}08`,
                  border: `1px solid ${colors.error}18`,
                  borderRadius: 12,
                  cursor: logoutLoading ? 'default' : 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  color: colors.error,
                  transition: 'all 0.15s ease',
                  opacity: logoutLoading ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!logoutLoading) e.currentTarget.style.background = `${colors.error}15`;
                }}
                onMouseLeave={(e) => {
                  if (!logoutLoading) e.currentTarget.style.background = `${colors.error}08`;
                }}
              >
                <LogOut size={14} />
                {logoutLoading ? 'Logging out...' : 'Log Out'}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
