import { useState, useEffect } from 'react';
import { colors } from '../../config/theme';
import { Input } from './Input';
import { Button } from '../shared/Button';
import { loadAuthState, saveAuthState, loginWithLicense } from '../../stores/authStore';

import synapseIcon from '../../assets/icon.png';

interface LoginPageProps {
  onSwitchToCreate: () => void;
  onLogin: (rememberMe: boolean, licenseKey: string) => void;
}

export function LoginPage({ onSwitchToCreate, onLogin }: LoginPageProps) {
  const [licenseKey, setLicenseKey] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAuthState().then((state) => {
      if (state?.isRemembered && state.licenseKey) {
        setLicenseKey(state.licenseKey);
        setRememberMe(true);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);

    try {
      const sessionData = await loginWithLicense(licenseKey);
      if (sessionData) {
        await saveAuthState(rememberMe, licenseKey, rememberMe ? sessionData : undefined);
        onLogin(rememberMe, licenseKey);
      } else {
        alert('Invalid or inactive license key');
      }
    } catch {
      alert('License activation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 32px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 320,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <img
          src={synapseIcon}
          alt="Synapse Z"
          style={{
            width: 72,
            height: 72,
            borderRadius: 16,
            marginBottom: 20,
          }}
        />

        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: colors.textWhite,
            marginBottom: 8,
          }}
        >
          Welcome to Synapse Z
        </h1>

        <p
          style={{
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 32,
          }}
        >
          Enter your license key to continue
        </p>

        <form
          onSubmit={handleSubmit}
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <Input
            label="License Key"
            type="text"
            placeholder="Enter your license key"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            autoComplete="off"
          />

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <div
              onClick={() => setRememberMe(!rememberMe)}
              style={{
                width: 36,
                height: 20,
                borderRadius: 10,
                background: rememberMe ? colors.primary : '#2a2a35',
                position: 'relative',
                transition: 'background 0.2s ease',
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: rememberMe ? colors.primaryContrast : colors.textWhite,
                  position: 'absolute',
                  top: 2,
                  left: rememberMe ? 18 : 2,
                  transition: 'left 0.2s ease',
                }}
              />
            </div>
            <span style={{ fontSize: 13, color: colors.textMuted }}>
              Remember this device
            </span>
          </label>

          <div style={{ marginTop: 8 }}>
            <Button type="submit" disabled={loading}>
              {loading ? 'Activating...' : 'Activate License'}
            </Button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginTop: 16,
            }}
          >
            <span style={{ fontSize: 13, color: colors.textMuted }}>
              Need help with activation?
            </span>
            <button
              type="button"
              onClick={onSwitchToCreate}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: colors.primary,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              View license info
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
