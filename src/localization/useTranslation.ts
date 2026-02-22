import { translate, TranslationKey } from './translations';
import { useAppSelector } from '../store/hooks';

export const useTranslation = () => {
  const appLanguage = useAppSelector(state => state.language.appLanguage);

  const t = (key: TranslationKey) => translate(appLanguage, key);

  return { t, appLanguage };
};
