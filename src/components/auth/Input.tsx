import { useState, InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { colors } from '../../config/theme';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'style'> {
  label?: string;
}

export function Input({ label, type, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {label && (
        <label
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: focused ? colors.textWhite : colors.textMuted,
            letterSpacing: '0.02em',
            transition: 'color 0.15s ease',
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <input
          {...props}
          type={inputType}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={{
            width: '100%',
            height: 42,
            padding: isPassword ? '0 42px 0 14px' : '0 14px',
            fontSize: 13,
            fontWeight: 400,
            letterSpacing: '0.01em',
            color: colors.textWhite,
            background: '#0F0F14',
            border: `1px solid ${focused ? colors.primary : '#1E1E28'}`,
            borderRadius: 6,
            outline: 'none',
            transition: 'all 0.2s ease',
            boxShadow: focused ? `0 0 0 3px ${colors.primary}15` : 'none',
          }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: colors.textMuted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}
