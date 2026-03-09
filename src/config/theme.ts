export const colors = {
  primary: '#FFFFFF',
  primaryBright: '#FFFFFF',
  primarySoft: '#D9D9D9',
  primaryDeep: '#B3B3B3',
  primaryContrast: '#0B0B0F',
  bgDark: '#0B0B0F',
  panelDark: '#12121A',
  surfaceDark: '#181824',
  textWhite: '#F2F2F7',
  textMuted: '#A1A1B3',
  border: '#2A2A35',
  error: '#FF4D6A',
  success: '#4ADE80',
} as const;

export type ColorKey = keyof typeof colors;
