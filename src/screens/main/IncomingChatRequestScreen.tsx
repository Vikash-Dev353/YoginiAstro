import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { View } from 'react-native';
import { OrderStackParamList } from '../../navigation/types';
import { requestIncomingChatOverlay } from '../../services/push/incomingChatOverlayEvents';

type Props = NativeStackScreenProps<OrderStackParamList, 'IncomingChatRequest'>;

/**
 * Legacy route — forwards to the one global incoming UI (RootNavigator modal).
 * Prevents a second, different Accept/Reject screen in the Order stack.
 */
export function IncomingChatRequestScreen({ navigation, route }: Props) {
  useEffect(() => {
    requestIncomingChatOverlay(route.params);
    const id = requestAnimationFrame(() => {
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    });
    return () => cancelAnimationFrame(id);
  }, [navigation, route.params]);

  return <View />;
}
