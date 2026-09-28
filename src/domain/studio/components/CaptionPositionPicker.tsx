import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import type { CaptionPosition } from '../types';

const OPTIONS: { value: CaptionPosition; label: string }[] = [
  { value: 'top', label: 'Topo' },
  { value: 'bottom', label: 'Rodapé' },
  { value: 'optional', label: 'Opcional' },
  { value: 'off', label: 'Desativada' },
];

export function CaptionPositionPicker({ value, onChange }: { value: CaptionPosition; onChange: (value: CaptionPosition) => void }) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable key={option.value} onPress={() => onChange(option.value)} style={[styles.chip, selected && styles.chipSelected]}>
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  chipSelected: { backgroundColor: colors.primary },
  chipText: { ...typography.small, color: colors.textSecondary },
  chipTextSelected: { color: colors.textInverse, fontWeight: '700' },
});
