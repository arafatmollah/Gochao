import { Tabs } from 'expo-router';

import { SlidingTabBar } from '@/components/sliding-tab-bar';
import { useTranslation } from '@/i18n';

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <SlidingTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: t('nav.home') }} />
      <Tabs.Screen name="tasks" options={{ title: t('nav.tasks') }} />
      <Tabs.Screen name="bills" options={{ title: t('nav.bills') }} />
      <Tabs.Screen name="finance" options={{ title: t('nav.finance') }} />
      <Tabs.Screen name="more" options={{ title: t('nav.more') }} />
    </Tabs>
  );
}
