import { ImageBackground, StatusBar, StyleSheet } from 'react-native';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { store } from './src/store';
import { RootNavigator } from './src/navigation/RootNavigator';
import { images } from './src/assets/images';
import { useEffect } from 'react';
import { getMessaging } from '@react-native-firebase/messaging';

function App() {

  useEffect(() => {
    console.log('App mounted');
    const getToken = async () => {
      let token = await getMessaging().getToken();
      console.log('token', token);
      // setAccessToken(token);
    }
    getToken();
  }, []);
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
