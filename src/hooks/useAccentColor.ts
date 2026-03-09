import { useState, useEffect } from 'react';
import { getSettings, subscribeToSettings } from '../stores/settingsStore';

function adjustColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const adjust = (c: number) => Math.min(255, Math.max(0, Math.round(c * factor)));

  return `#${adjust(r).toString(16).padStart(2, '0')}${adjust(g).toString(16).padStart(2, '0')}${adjust(b).toString(16).padStart(2, '0')}`;
}

function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
}

export interface AccentColors {
  primary: string;
  primaryBright: string;
  primarySoft: string;
  primaryDeep: string;
  contrastText: string;
}

function generateAccentColors(baseColor: string): AccentColors {
  return {
    primary: baseColor,
    primaryBright: adjustColor(baseColor, 1.15),
    primarySoft: adjustColor(baseColor, 0.85),
    primaryDeep: adjustColor(baseColor, 0.7),
    contrastText: isLightColor(baseColor) ? '#0B0B0F' : '#F2F2F7',
  };
}

export function useAccentColor(): AccentColors {
  const [accentColors, setAccentColors] = useState<AccentColors>(() =>
    generateAccentColors(getSettings().appearance.accentColor)
  );

  useEffect(() => {
    const unsubscribe = subscribeToSettings(() => {
      const newColor = getSettings().appearance.accentColor;
      setAccentColors(generateAccentColors(newColor));
    });
    return unsubscribe;
  }, []);

  return accentColors;
}
