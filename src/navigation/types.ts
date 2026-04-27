import type { NavigatorScreenParams } from '@react-navigation/native';
import type { GenerateKundaliPayload } from '../services/api/astroApi';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  CompleteProfile: undefined;
  PendingApproval: undefined;
  OtpVerification: {
    mobile: string;
    /** Register/login both use same send-otp endpoint; flow only affects verify step. */
    flow?: 'login' | 'register';
  };
  TermsAndConditions: undefined;
  PrivacyPolicy: undefined;
};

export type OrderStackParamList = {
  OrderList: { initialTab?: 'Waitlist' | 'Voice Call' | 'Chat' | 'Pooja Booking' } | undefined;
  ViewKundli: { name: string; id?: string; kundaliPayload?: GenerateKundaliPayload };
  IncomingChatRequest: {
    roomId: string;
    from?: string;
    customerName: string;
    customerImage?: string | null;
    message?: string;
    /** Line under name, e.g. “Yoginiastro User” */
    subtitle?: string;
    kundliUrl?: string;
    kundaliPayload?: GenerateKundaliPayload;
    userBalance?: number;
    astroPrice?: number;
  };
  ConsultationChat: {
    customerName: string;
    roomId: string;
    senderId?: string;
    kundaliPayload?: GenerateKundaliPayload;
    customerImage?: string | null;
  };
  AttachmentViewer: {
    uri: string;
    name?: string;
    type: 'image' | 'pdf' | 'video' | 'audio';
  };
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
