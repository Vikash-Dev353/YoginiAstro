import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { AppLanguage } from '../../localization/translations';
import { storage } from '../../utils/storage';

type LanguageState = {
  appLanguage: AppLanguage;
  isBootstrapping: boolean;
};

const initialState: LanguageState = {
  appLanguage: 'en',
  isBootstrapping: true,
};

export const bootstrapLanguage = createAsyncThunk('language/bootstrap', async () => {
  const language = await storage.getAppLanguage();
  return language || 'en';
});

export const changeAppLanguage = createAsyncThunk(
  'language/change',
  async (language: AppLanguage) => {
    await storage.setAppLanguage(language);
    return language;
  },
);

const languageSlice = createSlice({
  name: 'language',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(bootstrapLanguage.fulfilled, (state, action) => {
        state.appLanguage = action.payload;
        state.isBootstrapping = false;
      })
      .addCase(bootstrapLanguage.rejected, state => {
        state.isBootstrapping = false;
      })
      .addCase(changeAppLanguage.fulfilled, (state, action) => {
        state.appLanguage = action.payload;
      });
  },
});

export const languageReducer = languageSlice.reducer;
