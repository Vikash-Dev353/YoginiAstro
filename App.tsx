import { ImageBackground, StatusBar, StyleSheet } from 'react-native';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { store } from './src/store';
import { images } from './src/assets/images';

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
