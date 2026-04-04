import type { NavigatorScreenParams } from '@react-navigation/native';
import type { GenerateKundaliPayload } from '../services/api/astroApi';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  OtpVerification: {
    mobile: string;
  };
  TermsAndConditions: undefined;
  PrivacyPolicy: undefined;
};

export type OrderStackParamList = {
  OrderList: { initialTab?: 'Waitlist' | 'Voice Call' | 'Chat' | 'Pooja Booking' } | undefined;
  ViewKundli: { name: string; id?: string; kundaliPayload?: GenerateKundaliPayload };
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  CompleteProfile: undefined;
  ProfileWallet: undefined;
  CustomerSupport: undefined;
  GoLiveNow: undefined;
  Review: undefined;
  Setting: undefined;
};

export type HomeStackParamList = {
  HomeMain: undefined;
  Support: undefined;
};

export type RootTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList> | undefined;
  Order: {
    initialTab?: 'Waitlist' | 'Voice Call' | 'Chat' | 'Pooja Booking';
  } | undefined;
  Wallet: undefined;
  Notification: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};
