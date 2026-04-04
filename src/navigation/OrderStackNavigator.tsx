import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OrderScreen } from '../screens/main/OrderScreen';
import { ViewKundliScreen } from '../screens/main/ViewKundliScreen';
import { OrderStackParamList, RootTabParamList } from './types';

const Stack = createNativeStackNavigator<OrderStackParamList>();

type Props = BottomTabScreenProps<RootTabParamList, 'Order'>;

/**
 * OrderList params (e.g. initialTab) are set via nested navigation from Home:
 * navigate('Order', { screen: 'OrderList', params: { initialTab: 'Chat' } }).
 * Do not use initialParams here — they only apply once and ignore later navigations.
 */
export function OrderStackNavigator(_props: Props) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OrderList" component={OrderScreen} />
      <Stack.Screen name="ViewKundli" component={ViewKundliScreen} />
    </Stack.Navigator>
  );
}
