import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/main/HomeScreen';
import { SupportScreen } from '../screens/main/SupportScreen';
import { HomeStackParamList, RootTabParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

type Props = BottomTabScreenProps<RootTabParamList, 'Home'>;

export function HomeStackNavigator(_props: Props) {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: 'none' }}
    >
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
    </Stack.Navigator>
  );
}
