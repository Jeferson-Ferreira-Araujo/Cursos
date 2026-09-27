import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography } from '@/theme';

type Props = {
  title: string;
  onBack?: () => void;
  showBack?: boolean;
  right?: React.ReactNode;
};

export function TopBar({ title, onBack, showBack = true, right }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.side}>
        {showBack && (
          <Pressable onPress={onBack ?? (() => router.back())} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
        )}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.rightSide]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  side: { width: 44, alignItems: 'flex-start' },
  rightSide: { alignItems: 'flex-end' },
  backButton: { padding: spacing.xs, marginLeft: -spacing.xs },
  title: { ...typography.h3, flex: 1, textAlign: 'center' },
});
