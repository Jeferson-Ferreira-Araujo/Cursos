import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';

type Tone = 'success' | 'warning' | 'neutral' | 'danger' | 'info';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.badge, toneStyles[tone].badge]}>
      <Text style={[styles.text, toneStyles[tone].text]}>{label}</Text>
    </View>
  );
}

const toneStyles: Record<Tone, { badge: object; text: object }> = {
  success: { badge: { backgroundColor: colors.successSoft }, text: { color: colors.success } },
  warning: { badge: { backgroundColor: colors.warningSoft }, text: { color: colors.warning } },
  danger: { badge: { backgroundColor: colors.dangerSoft }, text: { color: colors.danger } },
  info: { badge: { backgroundColor: colors.infoSoft }, text: { color: colors.info } },
  neutral: { badge: { backgroundColor: colors.surfaceMuted }, text: { color: colors.textSecondary } },
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 12, fontWeight: '600' },
});
