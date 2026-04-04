import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { images } from '../assets/images';
import { colors } from '../constants/colors';
import { useTranslation } from '../localization/useTranslation';
import { HomeScreen } from '../screens/main/HomeScreen';
import { NotificationScreen } from '../screens/main/NotificationScreen';
import { OrderStackNavigator } from './OrderStackNavigator';
import { WalletScreen } from '../screens/main/WalletScreen';
import { ProfileStackNavigator } from './ProfileStackNavigator';
import { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

const CustomTabBar = memo(
  ({ state, descriptors, navigation }: BottomTabBarProps) => {
    const { t } = useTranslation();
    const tabMeta: Record<keyof RootTabParamList, { label: string; icon: number }> = {
      Home: { label: t('common.home'), icon: images.tabHome },
      Order: { label: t('common.order'), icon: images.tabOrder },
      Wallet: { label: t('common.wallet'), icon: images.tabWallet },
      Notification: { label: t('common.notification'), icon: images.tabNotification },
      Profile: { label: t('common.profile'), icon: images.tabProfile },
    };

    return (
      <View style={styles.tabWrapper}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const routeName = route.name as keyof RootTabParamList;
          const { label, icon } = tabMeta[routeName];

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
                source={icon}
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
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
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
