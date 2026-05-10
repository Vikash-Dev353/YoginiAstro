import { ImageBackground, StatusBar, StyleSheet } from 'react-native';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { store } from './src/store';
import { RootNavigator } from './src/navigation/RootNavigator';
import { images } from './src/assets/images';
import { IncomingChatDebugPanel } from './src/components/dev/IncomingChatDebugPanel';

function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <ImageBackground
          source={images.appBackground}
          style={styles.rootBg}
          resizeMode="cover"
        >
          <StatusBar barStyle="dark-content" />
          <RootNavigator />
          {__DEV__ ? <IncomingChatDebugPanel /> : null}
        </ImageBackground>
      </SafeAreaProvider>
    </Provider>
  );
}

const styles = StyleSheet.create({
  rootBg: {
    flex: 1,
  },
});

export default App;
