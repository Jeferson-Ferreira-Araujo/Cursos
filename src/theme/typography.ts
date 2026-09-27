import { TextStyle } from 'react-native';
import { colors } from './colors';

export const typography = {
  h1: { fontSize: 28, fontWeight: '700', color: colors.textPrimary, lineHeight: 34 } satisfies TextStyle,
  h2: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, lineHeight: 28 } satisfies TextStyle,
  h3: { fontSize: 18, fontWeight: '600', color: colors.textPrimary, lineHeight: 24 } satisfies TextStyle,
  body: { fontSize: 15, fontWeight: '400', color: colors.textPrimary, lineHeight: 21 } satisfies TextStyle,
  bodyMedium: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, lineHeight: 21 } satisfies TextStyle,
  caption: { fontSize: 13, fontWeight: '400', color: colors.textSecondary, lineHeight: 18 } satisfies TextStyle,
  small: { fontSize: 12, fontWeight: '500', color: colors.textMuted, lineHeight: 16 } satisfies TextStyle,
} as const;
