import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import React from 'react';

import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useThemeColors } from '@/src/useThemeColors';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={20} style={{ marginBottom: -1 }} {...props} />;
}

export default function TabLayout() {
  const c = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.signal,
        tabBarInactiveTintColor: c.tabIconDefault,
        tabBarStyle: {
          backgroundColor: c.background,
          borderTopColor: c.border,
          height: 58,
          paddingTop: 4,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: {
          backgroundColor: c.background,
          borderBottomColor: c.border,
          shadowOpacity: 0,
          elevation: 0,
        },
        headerTitleStyle: { fontWeight: '700', color: c.text },
        headerTintColor: c.text,
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: 'Navbe',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="flows"
        options={{
          title: 'Flows',
          tabBarIcon: ({ color }) => <TabBarIcon name="sitemap" color={color} />,
        }}
      />
      <Tabs.Screen
        name="runs"
        options={{
          title: 'Runs',
          tabBarIcon: ({ color }) => <TabBarIcon name="play-circle" color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedules"
        options={{
          title: 'Schedules',
          tabBarIcon: ({ color }) => <TabBarIcon name="clock-o" color={color} />,
        }}
      />
    </Tabs>
  );
}
