import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { Button } from './Button';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Algo deu errado</Text>
      <Text style={styles.message}>{message}</Text>
      {!!onRetry && (
        <View style={styles.action}>
          <Button label="Tentar novamente" variant="secondary" onPress={onRetry} fullWidth={false} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.sm },
  title: { ...typography.h3, color: colors.danger },
  message: { ...typography.caption, textAlign: 'center' },
  action: { marginTop: spacing.md },
});
