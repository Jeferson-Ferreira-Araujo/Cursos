import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

const logoMark = require('../../../assets/logo-mark.png');

export function Logo({ size = 48 }: { size?: number }) {
  return (
    <View style={styles.container}>
      <Image source={logoMark} style={{ width: size, height: size }} contentFit="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'flex-start' },
});
