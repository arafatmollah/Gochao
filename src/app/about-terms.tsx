import { AboutTextScreen } from '@/features/about/components/about-text-screen';
import { useTranslation } from '@/i18n';

export default function AboutTermsScreen() {
  const { t } = useTranslation();
  return (
    <AboutTextScreen
      title={t('about.termsTitle')}
      body={t('about.termsBody')}
      headerTestID="about-terms-header"
      bodyTestID="about-terms-body"
      backFallback="/about"
    />
  );
}
