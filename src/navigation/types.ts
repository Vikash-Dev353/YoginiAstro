export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  OtpVerification: {
    mobile: string;
  };
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
