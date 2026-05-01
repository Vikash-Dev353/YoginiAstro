import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AttachmentViewerScreen } from '../screens/main/AttachmentViewerScreen';
import { ConsultationChatScreen } from '../screens/main/ConsultationChatScreen';
import { IncomingChatRequestScreen } from '../screens/main/IncomingChatRequestScreen';
import { KundliBirthChartScreen } from '../screens/main/KundliBirthChartScreen';
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
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: 'none' }}
    >
      <Stack.Screen name="OrderList" component={OrderScreen} />
      <Stack.Screen name="IncomingChatRequest" component={IncomingChatRequestScreen} />
      <Stack.Screen name="KundliBirthChart" component={KundliBirthChartScreen} />
      <Stack.Screen name="ViewKundli" component={ViewKundliScreen} />
      <Stack.Screen name="ConsultationChat" component={ConsultationChatScreen} />
      <Stack.Screen name="AttachmentViewer" component={AttachmentViewerScreen} />
    </Stack.Navigator>
  );
}
