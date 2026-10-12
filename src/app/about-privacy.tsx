import { AboutTextScreen } from '@/features/about/components/about-text-screen';
import { useTranslation } from '@/i18n';

export default function AboutPrivacyScreen() {
  const { t } = useTranslation();
  return (
    <AboutTextScreen
      title={t('about.privacyTitle')}
      body={t('about.privacyBody')}
      headerTestID="about-privacy-header"
      bodyTestID="about-privacy-body"
      backFallback="/about"
    />
  );
}
