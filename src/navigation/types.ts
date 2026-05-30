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
    /** From send-otp when account was just created — after verify, open Complete Profile. */
    isNewAstrologer?: boolean;
  };
  TermsAndConditions: undefined;
  PrivacyPolicy: undefined;
};

export type OrderStackParamList = {
  OrderList: { initialTab?: 'Waitlist' | 'Voice Call' | 'Chat' | 'Pooja Booking' } | undefined;
  /** Birth-details form → replaces ViewKundli with generated payload */
  KundliBirthChart: undefined;
  ViewKundli: { name: string; id?: string; kundaliPayload?: GenerateKundaliPayload };
  IncomingChatRequest: {
    roomId: string;
    from?: string;
    customerName: string;
    customerImage?: string | null;
    /** FCM / Notifee notification title (shown on custom incoming screen). */
    notificationTitle?: string;
    /** FCM / Notifee notification body (shown on custom incoming screen). */
    notificationBody?: string;
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
  EditProfile: undefined;
  CustomerSupport: undefined;
  GoLiveNow: undefined;
  ComingSoon:
    | { showHeader?: boolean; feature?: 'goLive' | 'form16a' }
    | undefined;
  Review: undefined;
  Setting: { fromHomeScreen?: boolean } | undefined;
  MonthlyPayout: undefined;
  TermsAndConditions: undefined;
  PrivacyPolicy: undefined;
};

export type HomeStackParamList = {
  HomeMain: undefined;
  Support: undefined;
  ComingSoon:
    | { showHeader?: boolean; feature?: 'goLive' | 'form16a' }
    | undefined;
};

export type RootTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList> | undefined;
  Order: NavigatorScreenParams<OrderStackParamList> | undefined;
  Wallet: undefined;
  Notification: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};
