import type { NavigatorScreenParams } from '@react-navigation/native';
import type { GenerateKundaliPayload } from '../services/api/astroApi';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  CompleteProfile: undefined;
  PendingApproval: undefined;
  OtpVerification: {
    mobile: string;
    /** Register flow uses `astrologer/register/send-otp`; login uses login send-otp */
    flow?: 'login' | 'register';
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
  CustomerSupport: undefined;
  GoLiveNow: undefined;
  Review: undefined;
  Setting: undefined;
  TermsAndConditions: undefined;
  PrivacyPolicy: undefined;
};

export type HomeStackParamList = {
  HomeMain: undefined;
  Support: undefined;
};

export type RootTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList> | undefined;
  Order: NavigatorScreenParams<OrderStackParamList> | undefined;
  Wallet: undefined;
  Notification: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};
