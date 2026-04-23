import { configureStore } from '@reduxjs/toolkit';
import { authReducer } from './slices/authSlice';
import { languageReducer } from './slices/languageSlice';
import { socketReducer } from './slices/socketSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    language: languageReducer,
    socket: socketReducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
