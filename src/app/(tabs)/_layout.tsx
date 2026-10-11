import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import { useTranslation } from '@/i18n';
import { Colors, Radius } from '@/theme/tokens';

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarActiveBackgroundColor: Colors.primarySoft,
        tabBarStyle: styles.bar,
        tabBarItemStyle: styles.item,
        tabBarLabelStyle: styles.label,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.home'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: t('nav.tasks'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'checkbox' : 'checkbox-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bills"
        options={{
          title: t('nav.bills'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: t('nav.finance'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t('nav.more'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  item: {
    borderRadius: Radius.md,
    marginVertical: 6,
    marginHorizontal: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
