import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { memo, useEffect, useRef } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { images } from '../assets/images';
import { colors } from '../constants/colors';
import { useTranslation } from '../localization/useTranslation';
import { parseKundliUrlToPayload } from '../services/api/astroApi';
import {
  foregroundIncomingOverlayActiveRef,
  isIncomingRoomHandled,
} from '../services/push/foregroundIncomingOverlay';
import { isIncomingChatAcceptInFlight } from '../services/push/incomingChatAcceptFlow';
import { selectChatRequests } from '../store/slices/socketSlice';
import { useAppSelector } from '../store/hooks';
import { HomeStackNavigator } from './HomeStackNavigator';
import { NotificationScreen } from '../screens/main/NotificationScreen';
import { OrderStackNavigator } from './OrderStackNavigator';
import { WalletScreen } from '../screens/main/WalletScreen';
import { ProfileStackNavigator } from './ProfileStackNavigator';
import { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

const CustomTabBar = memo(
  ({ state, descriptors, navigation }: BottomTabBarProps) => {
    const { t } = useTranslation();
    const socketChatRequests = useAppSelector(selectChatRequests);
    const lastNotifiedRoomIdRef = useRef<string | null>(null);
    const currentTabRoute = state.routes[state.index];
    const nestedRouteName = getFocusedRouteNameFromRoute(currentTabRoute);

    useEffect(() => {
      if (foregroundIncomingOverlayActiveRef.current) {
        return;
      }
      const [firstRequest] = socketChatRequests;
      if (!firstRequest?.roomId) {
        lastNotifiedRoomIdRef.current = null;
        return;
      }
      if (
        isIncomingRoomHandled(firstRequest.roomId) ||
        isIncomingChatAcceptInFlight(firstRequest.roomId)
      ) {
        return;
      }
      if (firstRequest.roomId === lastNotifiedRoomIdRef.current) {
        return;
      }
      if (
        nestedRouteName === 'ConsultationChat' ||
        nestedRouteName === 'IncomingChatRequest'
      ) {
        return;
      }

      lastNotifiedRoomIdRef.current = firstRequest.roomId;
      navigation.navigate('Order', {
        screen: 'IncomingChatRequest',
        params: {
          roomId: firstRequest.roomId,
          from: firstRequest.senderId || firstRequest.from,
          customerName:
            firstRequest.userData?.fullName ||
            firstRequest.senderName ||
            'Unknown User',
          customerImage: firstRequest.userData?.profileImage ?? firstRequest.senderImage,
          message: firstRequest.message,
          subtitle: firstRequest.subtitle,
          kundliUrl: firstRequest.kundliUrl,
          kundaliPayload: parseKundliUrlToPayload(firstRequest.kundliUrl),
          userBalance: firstRequest.balance?.balance,
          astroPrice: firstRequest.astroData?.price,
        },
      });
    }, [navigation, nestedRouteName, socketChatRequests]);

    /** Hide tabs on live chat / incoming request so bottom actions stay visible. */
    if (
      currentTabRoute.name === 'Order' &&
      (nestedRouteName === 'ConsultationChat' ||
        nestedRouteName === 'IncomingChatRequest')
    ) {
      return null;
    }

    const tabMeta: Record<
      keyof RootTabParamList,
      { label: string; icon: number; activeIcon?: number }
    > = {
      Home: {
        label: t('common.home'),
        icon: images.tabHome,
        activeIcon: images.tabHomeActive,
      },
      Order: {
        label: t('common.order'),
        icon: images.tabOrder,
        activeIcon: images.tabOrderActive,
      },
      Wallet: {
        label: t('common.wallet'),
        icon: images.tabWallet,
        activeIcon: images.tabWalletActive,
      },
      Notification: {
        label: t('common.notification'),
        icon: images.tabNotification,
        activeIcon: images.tabNotificationActive,
      },
      Profile: {
        label: t('common.profile'),
        icon: images.tabProfile,
        activeIcon: images.iconamoonProfileCircleFill,
      },
    };

    return (
      <View style={styles.tabWrapper}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const routeName = route.name as keyof RootTabParamList;
          const { label, icon, activeIcon } = tabMeta[routeName];
          const iconSource = isFocused && activeIcon ? activeIcon : icon;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (event.defaultPrevented) {
              return;
            }

            if (routeName === 'Profile') {
              navigation.navigate('Profile', { screen: 'ProfileHome' });
              return;
            }

            if (routeName === 'Home') {
              navigation.navigate('Home', { screen: 'HomeMain' });
              return;
            }

            if (!isFocused) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityLabel={
                descriptors[route.key].options.tabBarAccessibilityLabel
              }
              onPress={onPress}
              style={styles.tabItem}
            >
              <Image
                source={iconSource}
                style={[styles.iconImage, isFocused && styles.iconImageFocused]}
                resizeMode="contain"
              />
              <Text
                style={[styles.tabLabel, isFocused && styles.tabLabelFocused]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  },
);

const renderTabBar = (props: BottomTabBarProps) => <CustomTabBar {...props} />;

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={renderTabBar}
      screenOptions={{
        headerShown: false,
        animation: 'none',
      }}
    >
      <Tab.Screen name="Home" component={HomeStackNavigator} />
      <Tab.Screen name="Order" component={OrderStackNavigator} />
      <Tab.Screen name="Wallet" component={WalletScreen} />
      <Tab.Screen name="Notification" component={NotificationScreen} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabWrapper: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    height: 84,
    borderRadius: 40,
    backgroundColor: '#F1F1F1',
    borderWidth: 1,
    borderColor: '#D4D4D4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#8C5D5D',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  iconCircleFocused: {
    backgroundColor: '#F1E8E8',
    borderColor: colors.maroon,
  },
  iconImage: {
    width: 24,
    height: 24,
    tintColor: '#5D4040',
  },
  iconImageFocused: {
    tintColor: colors.maroon,
  },
  tabLabel: {
    fontSize: 12,
    color: '#3F3030',
  },
  tabLabelFocused: {
    fontWeight: '700',
    color: '#2E1818',
  },
});
