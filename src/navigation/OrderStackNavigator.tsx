import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OrderScreen } from '../screens/main/OrderScreen';
import { ViewKundliScreen } from '../screens/main/ViewKundliScreen';
import { OrderStackParamList, RootTabParamList } from './types';

const Stack = createNativeStackNavigator<OrderStackParamList>();

type Props = BottomTabScreenProps<RootTabParamList, 'Order'>;

export function OrderStackNavigator({ route }: Props) {
  const initialTab = route.params?.initialTab;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="OrderList"
        component={OrderScreen}
        initialParams={{ initialTab }}
      />
      <Stack.Screen name="ViewKundli" component={ViewKundliScreen} />
    </Stack.Navigator>
  );
}
