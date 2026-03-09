import { useState, useEffect, useSyncExternalStore, useRef } from 'react';
import { colors } from '../../config/theme';
import { X, Trash2, Users, Gamepad2, Loader2, AlertCircle, Play, Copy, Check } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import {
  loadClientManager,
  getClientManager,
  subscribeClientManager,
  addAccount,
  removeAccount,
  addGame,
  removeGame,
  RobloxAccount,
  RobloxGame,
} from '../../stores/clientManagerStore';

interface ClientManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ClientManagerDialog({ isOpen, onClose }: ClientManagerDialogProps) {
  const data = useSyncExternalStore(subscribeClientManager, getClientManager);
  const [activeTab, setActiveTab] = useState<'accounts' | 'games'>('accounts');
  const [cookieInput, setCookieInput] = useState('');
  const [gameIdInput, setGameIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [launchGame, setLaunchGame] = useState<RobloxGame | null>(null);
  const cookieRef = useRef<HTMLInputElement>(null);
  const gameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadClientManager();
  }, []);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setTimeout(() => {
        if (activeTab === 'accounts') cookieRef.current?.focus();
        else gameRef.current?.focus();
      }, 100);
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (launchGame) setLaunchGame(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose, launchGame]);

  if (!isOpen) return null;

  const handleAddAccount = async () => {
    if (!cookieInput.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      await addAccount(cookieInput.trim());
      setCookieInput('');
    } catch (e: any) {
      setError(e.message || 'Failed to add account');
    }
    setLoading(false);
  };

  const handleAddGame = async () => {
    const id = parseInt(gameIdInput.trim(), 10);
    if (isNaN(id) || loading) return;
    setLoading(true);
    setError('');
    try {
      await addGame(id);
      setGameIdInput('');
    } catch (e: any) {
      setError(e.message || 'Failed to add game');
    }
    setLoading(false);
  };

  const handlePlayClick = (game: RobloxGame) => {
    if (data.accounts.length === 0) {
      setError('Add an account first before launching a game');
      return;
    }
    setLaunchGame(game);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        zIndex: 10002,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 580,
          maxHeight: '82vh',
          background: '#0e0e14',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16,
          boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '20px 24px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Users size={16} color={colors.textMuted} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, color: colors.textWhite, letterSpacing: '-0.01em' }}>
              Client Manager
            </span>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <div style={{ padding: '12px 24px 0' }}>
          <div style={{
            display: 'flex',
            gap: 2,
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 10,
            padding: 3,
          }}>
            <TabButton
              active={activeTab === 'accounts'}
              icon={<Users size={13} />}
              label="Accounts"
              count={data.accounts.length}
              onClick={() => { setActiveTab('accounts'); setError(''); }}
            />
            <TabButton
              active={activeTab === 'games'}
              icon={<Gamepad2 size={13} />}
              label="Games"
              count={data.games.length}
              onClick={() => { setActiveTab('games'); setError(''); }}
            />
          </div>
        </div>

        <div style={{ padding: '16px 24px 24px', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'accounts' ? (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <input
                  ref={cookieRef}
                  type="password"
                  placeholder="Paste .ROBLOSECURITY cookie..."
                  value={cookieInput}
                  onChange={(e) => setCookieInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddAccount()}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    fontSize: 13,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 9,
                    color: colors.textWhite,
                    outline: 'none',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.15s ease',
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}
                />
                <AddButton onClick={handleAddAccount} loading={loading} />
              </div>

              {error && <ErrorBanner message={error} />}

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.accounts.length === 0 ? (
                  <EmptyState icon={<Users size={28} strokeWidth={1.5} />} text="No accounts added yet" />
                ) : (
                  data.accounts.map((account) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      onRemove={() => removeAccount(account.id)}
                    />
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <input
                  ref={gameRef}
                  type="text"
                  placeholder="Enter Place ID..."
                  value={gameIdInput}
                  onChange={(e) => setGameIdInput(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddGame()}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    fontSize: 13,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 9,
                    color: colors.textWhite,
                    outline: 'none',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.15s ease',
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}
                />
                <AddButton onClick={handleAddGame} loading={loading} />
              </div>

              {error && <ErrorBanner message={error} />}

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.games.length === 0 ? (
                  <EmptyState icon={<Gamepad2 size={28} strokeWidth={1.5} />} text="No games added yet" />
                ) : (
                  data.games.map((game) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      onRemove={() => removeGame(game.id)}
                      onLaunch={() => handlePlayClick(game)}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {launchGame && (
        <LaunchPrompt
          game={launchGame}
          accounts={data.accounts}
          onClose={() => setLaunchGame(null)}
        />
      )}
    </div>
  );
}

function LaunchPrompt({ game, accounts, onClose }: {
  game: RobloxGame;
  accounts: RobloxAccount[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState('');
  const [launchStatus, setLaunchStatus] = useState('');

  const toggleAccount = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === accounts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(accounts.map((a) => a.id)));
    }
  };

  const handleLaunch = async () => {
    if (selected.size === 0 || launching) return;
    setLaunching(true);
    setLaunchError('');

    const selectedAccounts = accounts.filter((a) => selected.has(a.id));
    let launched = 0;

    for (const account of selectedAccounts) {
      setLaunchStatus(`Authenticating ${account.username}...`);
      try {
        const ticket = await invoke<string>('get_roblox_auth_ticket', { cookie: account.cookie });
        const timestamp = Date.now();
        const browserId = Math.floor(Math.random() * 1000000000);
        const launchUrl = `roblox-player:1+launchmode:play+gameinfo:${ticket}+launchtime:${timestamp}+placelauncherurl:https://assetgame.roblox.com/game/PlaceLauncher.ashx?request=RequestGame%26placeId=${game.placeId}%26isPlayTogetherGame=false+browsertrackerid:${browserId}+robloxLocale:en_us+gameLocale:en_us`;
        await invoke('open_roblox_url', { url: launchUrl });
        launched++;
        if (selectedAccounts.length > 1 && launched < selectedAccounts.length) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      } catch (e: any) {
        setLaunchError(`Failed to launch as ${account.username}: ${e.message || e}`);
        break;
      }
    }

    setLaunchStatus('');
    setLaunching(false);
    if (!launchError && launched > 0) {
      onClose();
    }
  };

  return (
    <div
      onClick={(e) => { e.stopPropagation(); if (!launching) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 10003,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxHeight: '70vh',
          background: '#111118',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f0' }}>
              Launch Game
            </span>
            <CloseButton onClick={onClose} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {game.thumbnailUrl ? (
              <img
                src={game.thumbnailUrl}
                alt=""
                style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', background: 'rgba(255,255,255,0.04)' }}
              />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Gamepad2 size={16} color="#3a3a4a" />
              </div>
            )}
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#c0c0cc', lineHeight: '17px' }}>{game.name}</div>
              <div style={{ fontSize: 11, color: '#55556a', lineHeight: '15px' }}>{game.placeId}</div>
            </div>
          </div>
        </div>

        <div style={{ padding: '12px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#6e6e80' }}>
            Select account{accounts.length > 1 ? 's' : ''}
          </span>
          {accounts.length > 1 && (
            <div
              onClick={selectAll}
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: '#55556a',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: 4,
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#8888a0'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#55556a'}
            >
              {selected.size === accounts.length ? 'Deselect all' : 'Select all'}
            </div>
          )}
        </div>

        <div style={{ padding: '0 20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240 }}>
          {accounts.map((account) => (
            <LaunchAccountRow
              key={account.id}
              account={account}
              selected={selected.has(account.id)}
              onClick={() => toggleAccount(account.id)}
            />
          ))}
        </div>

        {launchError && (
          <div style={{ padding: '0 20px', marginTop: 8 }}>
            <ErrorBanner message={launchError} />
          </div>
        )}

        <div style={{
          padding: '14px 20px 18px',
          display: 'flex',
          gap: 8,
          borderTop: '1px solid rgba(255,255,255,0.05)',
          marginTop: 8,
        }}>
          <button
            onClick={onClose}
            disabled={launching}
            style={{
              flex: 1,
              padding: '10px 0',
              fontSize: 13,
              fontWeight: 500,
              background: 'rgba(255,255,255,0.04)',
              color: '#8888a0',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 9,
              cursor: launching ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleLaunch}
            disabled={selected.size === 0 || launching}
            style={{
              flex: 2,
              padding: '10px 0',
              fontSize: 13,
              fontWeight: 600,
              background: selected.size === 0
                ? 'rgba(74,222,128,0.06)'
                : launching
                  ? 'rgba(74,222,128,0.15)'
                  : 'rgba(74,222,128,0.15)',
              color: selected.size === 0 ? '#2a6e40' : '#4ADE80',
              border: '1px solid rgba(74,222,128,0.12)',
              borderRadius: 9,
              cursor: selected.size === 0 || launching ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
            onMouseEnter={(e) => { if (selected.size > 0 && !launching) e.currentTarget.style.background = 'rgba(74,222,128,0.22)'; }}
            onMouseLeave={(e) => { if (selected.size > 0) e.currentTarget.style.background = 'rgba(74,222,128,0.15)'; }}
          >
            {launching ? (
              <>
                <Loader2 size={14} style={{ animation: 'loaderSpin 1s linear infinite' }} />
                {launchStatus || 'Launching...'}
              </>
            ) : (
              <>
                <Play size={12} fill="#4ADE80" />
                Launch{selected.size > 1 ? ` (${selected.size})` : selected.size === 1 ? '' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function LaunchAccountRow({ account, selected, onClick }: {
  account: RobloxAccount;
  selected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 10px',
        borderRadius: 9,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        background: selected ? 'rgba(74,222,128,0.06)' : hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
        border: `1px solid ${selected ? 'rgba(74,222,128,0.15)' : 'transparent'}`,
      }}
    >
      <div style={{
        width: 18,
        height: 18,
        borderRadius: 5,
        border: `1.5px solid ${selected ? '#4ADE80' : '#3a3a4a'}`,
        background: selected ? 'rgba(74,222,128,0.15)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.15s ease',
      }}>
        {selected && <Check size={11} color="#4ADE80" strokeWidth={3} />}
      </div>

      {account.avatarUrl ? (
        <img
          src={account.avatarUrl}
          alt=""
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            objectFit: 'cover',
            background: 'rgba(255,255,255,0.04)',
            flexShrink: 0,
          }}
        />
      ) : (
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          background: 'rgba(255,255,255,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Users size={14} color="#3a3a4a" />
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 500,
          color: selected ? '#e0e0ea' : '#b0b0bc',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: '17px',
        }}>
          {account.username}
        </div>
        <div style={{
          fontSize: 11,
          color: '#55556a',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: '15px',
        }}>
          {account.displayName !== account.username ? account.displayName : `ID: ${account.userId}`}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, icon, label, count, onClick }: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        padding: '9px 0',
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        border: 'none',
        cursor: 'pointer',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        transition: 'all 0.15s ease',
        background: active ? 'rgba(255,255,255,0.08)' : hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
        color: active ? '#f0f0f5' : '#6e6e80',
      }}
    >
      {icon}
      {label}
      {count > 0 && (
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          padding: '1px 6px',
          borderRadius: 5,
          background: active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
          color: active ? '#c0c0cc' : '#55556a',
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 28,
        height: 28,
        borderRadius: 7,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        background: hovered ? 'rgba(255,255,255,0.08)' : 'transparent',
      }}
    >
      <X size={14} color={hovered ? '#b0b0bc' : '#5a5a6e'} />
    </div>
  );
}

function AddButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '10px 18px',
        fontSize: 13,
        fontWeight: 600,
        background: loading ? 'rgba(255,255,255,0.06)' : hovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.08)',
        color: loading ? '#55556a' : '#e0e0ea',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 9,
        cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
      }}
    >
      {loading && <Loader2 size={14} style={{ animation: 'loaderSpin 1s linear infinite' }} />}
      {loading ? 'Adding...' : 'Add'}
    </button>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      padding: '10px 14px',
      marginBottom: 10,
      background: 'rgba(255,77,106,0.06)',
      border: '1px solid rgba(255,77,106,0.12)',
      borderRadius: 9,
      fontSize: 13,
      color: '#ff6b82',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <AlertCircle size={14} style={{ flexShrink: 0 }} />
      {message}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      padding: '48px 0',
    }}>
      <div style={{ color: '#3a3a4a' }}>{icon}</div>
      <span style={{ fontSize: 13, color: '#4a4a5a' }}>{text}</span>
    </div>
  );
}

function AccountCard({ account, onRemove }: { account: RobloxAccount; onRemove: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyCookie = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(account.cookie);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        background: hovered ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.04)',
        borderRadius: 10,
        transition: 'all 0.15s ease',
      }}
    >
      {account.avatarUrl ? (
        <img
          src={account.avatarUrl}
          alt=""
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            objectFit: 'cover',
            background: 'rgba(255,255,255,0.04)',
            flexShrink: 0,
          }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          background: 'rgba(255,255,255,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Users size={18} color="#3a3a4a" />
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: '#e8e8f0',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: '18px',
        }}>
          {account.username}
        </div>
        <div style={{
          fontSize: 12,
          color: '#6e6e80',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: '16px',
        }}>
          {account.displayName !== account.username ? account.displayName : `ID: ${account.userId}`}
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: 4,
        opacity: hovered ? 1 : 0,
        transition: 'opacity 0.15s ease',
      }}>
        <IconButton
          icon={copied ? <Check size={13} color="#4ADE80" /> : <Copy size={13} />}
          tooltip="Copy cookie"
          onClick={handleCopyCookie}
        />
        <IconButton
          icon={<Trash2 size={13} />}
          tooltip="Remove"
          onClick={onRemove}
          danger
        />
      </div>
    </div>
  );
}

function GameCard({ game, onRemove, onLaunch }: { game: RobloxGame; onRemove: () => void; onLaunch: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        background: hovered ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.04)',
        borderRadius: 10,
        transition: 'all 0.15s ease',
      }}
    >
      {game.thumbnailUrl ? (
        <img
          src={game.thumbnailUrl}
          alt=""
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            objectFit: 'cover',
            background: 'rgba(255,255,255,0.04)',
            flexShrink: 0,
          }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: 'rgba(255,255,255,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Gamepad2 size={18} color="#3a3a4a" />
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: '#e8e8f0',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: '18px',
        }}>
          {game.name}
        </div>
        <div style={{
          fontSize: 12,
          color: '#6e6e80',
          lineHeight: '16px',
        }}>
          {game.placeId}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        <PlayButton onClick={onLaunch} visible={hovered} />
        <div style={{
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.15s ease',
        }}>
          <IconButton
            icon={<Trash2 size={13} />}
            tooltip="Remove"
            onClick={onRemove}
            danger
          />
        </div>
      </div>
    </div>
  );
}

function PlayButton({ onClick, visible }: { onClick: () => void; visible: boolean }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: 28,
        paddingLeft: 8,
        paddingRight: 10,
        borderRadius: 7,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        background: hovered ? 'rgba(74,222,128,0.18)' : 'rgba(74,222,128,0.1)',
        opacity: visible ? 1 : 0,
        fontSize: 12,
        fontWeight: 600,
        color: '#4ADE80',
      }}
    >
      <Play size={11} fill="#4ADE80" />
      Play
    </div>
  );
}

function IconButton({ icon, tooltip, onClick, danger }: {
  icon: React.ReactNode;
  tooltip: string;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={tooltip}
      style={{
        width: 28,
        height: 28,
        borderRadius: 7,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        background: hovered
          ? danger ? 'rgba(255,77,106,0.12)' : 'rgba(255,255,255,0.08)'
          : 'transparent',
        color: hovered
          ? danger ? '#ff6b82' : '#b0b0bc'
          : '#55556a',
      }}
    >
      {icon}
    </div>
  );
}
