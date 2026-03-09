import { useState, ButtonHTMLAttributes } from 'react';
import { colors } from '../../config/theme';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  variant?: 'primary' | 'secondary';
  size?: 'default' | 'small';
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'default',
  fullWidth = true,
  children,
  ...props
}: ButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const isPrimary = variant === 'primary';
  const isSmall = size === 'small';

  const getBackground = () => {
    if (!isPrimary) {
      return pressed ? '#1E1E28' : hovered ? '#161620' : 'transparent';
    }
    if (pressed) return colors.primaryDeep;
    if (hovered) return colors.primaryBright;
    return colors.primary;
  };

  return (
    <button
      {...props}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        width: fullWidth ? '100%' : 'auto',
        height: isSmall ? 34 : 42,
        padding: isSmall ? '0 14px' : '0 20px',
        fontSize: isSmall ? 12 : 13,
        fontWeight: 600,
        letterSpacing: '0.02em',
        color: isPrimary ? colors.primaryContrast : colors.textWhite,
        background: getBackground(),
        border: isPrimary ? 'none' : '1px solid #1E1E28',
        borderRadius: 6,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.5 : 1,
        transition: 'all 0.15s ease',
        transform: pressed && !props.disabled ? 'scale(0.98)' : 'scale(1)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {children}
    </button>
  );
}
