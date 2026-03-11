export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  OtpVerification: {
    mobile: string;
  };
  TermsAndConditions: undefined;
  PrivacyPolicy: undefined;
};

import type { GenerateKundaliPayload } from '../services/api/astroApi';

export type OrderStackParamList = {
  OrderList: { initialTab?: 'Waitlist' | 'Voice Call' | 'Chat' | 'Pooja Booking' } | undefined;
  ViewKundli: { name: string; id?: string; kundaliPayload?: GenerateKundaliPayload };
};

export type RootTabParamList = {
  Home: undefined;
  Order: {
    initialTab?: 'Waitlist' | 'Voice Call' | 'Chat' | 'Pooja Booking';
  } | undefined;
  Wallet: undefined;
  Notification: undefined;
  Profile: undefined;
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
