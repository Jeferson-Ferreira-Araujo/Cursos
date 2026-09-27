export const colors = {
  primary: '#635BFF',
  primaryDark: '#4B43E0',
  primarySoft: '#EEEDFF',

  background: '#F7F7FB',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F2F6',
  border: '#E4E4EE',

  textPrimary: '#14142B',
  textSecondary: '#5A5A72',
  textMuted: '#9291A5',
  textInverse: '#FFFFFF',

  success: '#1FAE64',
  successSoft: '#E4F8ED',
  warning: '#E5940A',
  warningSoft: '#FCF0DC',
  danger: '#E24C4C',
  dangerSoft: '#FBE7E7',
  info: '#3B82F6',
  infoSoft: '#E8F0FE',
} as const;

export type ColorToken = keyof typeof colors;
