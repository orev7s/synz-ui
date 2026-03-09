import { useState } from 'react';
import { colors } from '../../config/theme';
import { Input } from './Input';
import { Button } from '../shared/Button';
import synapseIcon from '../../assets/icon.png';

interface CreateAccountPageProps {
  onSwitchToLogin: () => void;
}

export function CreateAccountPage({ onSwitchToLogin }: CreateAccountPageProps) {
  const [licenseKey, setLicenseKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 32px',
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
            width: 64,
            height: 64,
            borderRadius: 14,
            marginBottom: 16,
          }}
        />

        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: colors.textWhite,
            marginBottom: 6,
          }}
        >
          License Activation
        </h1>

        <p
          style={{
            fontSize: 13,
            color: colors.textMuted,
            marginBottom: 24,
          }}
        >
          Activation now uses a license key only
        </p>

        <form
          onSubmit={handleSubmit}
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
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

          <div style={{ marginTop: 6 }}>
            <Button type="submit">Review License</Button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginTop: 12,
            }}
          >
            <span style={{ fontSize: 13, color: colors.textMuted }}>
              Ready to activate?
            </span>
            <button
              type="button"
              onClick={onSwitchToLogin}
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
              Go back
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
