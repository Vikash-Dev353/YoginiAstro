import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { images } from '../../assets/images';
import { normalizeFont } from '../../utils/responsive';

type AppGifLoaderProps = {
  message?: string;
  size?: number;
};

const DEFAULT_SIZE = 250;

export function AppGifLoader({ message, size = DEFAULT_SIZE }: AppGifLoaderProps) {
  return (
    <View style={styles.container}>
      <Image
        source={images.loaderGif}
        style={[styles.gif]}
        resizeMode="contain"
      />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  gif: {
    width: 250,
    height: 250,
  },
  message: {
    marginTop: 16,
    color: colors.textSecondary,
    fontSize: normalizeFont(16),
    textAlign: 'center',
  },
});
