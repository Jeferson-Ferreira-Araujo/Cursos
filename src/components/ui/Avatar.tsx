import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '@/theme';

export function Avatar({ name, uri, size = 40 }: { name: string; uri?: string | null; size?: number }) {
  const initials = getInitials(name);

  if (uri) {
    return <Image source={{ uri }} style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} />;
  }

  return (
    <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initials}</Text>
    </View>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase();
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.surfaceMuted },
  placeholder: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: colors.primary, fontWeight: '700' },
});
