import { Tabs } from 'expo-router';
import { BottomNavigation } from '@/components';

const tabs = [
  { key: 'index', label: 'Inicio', icon: 'home-outline' as const },
  { key: 'tasks', label: 'Tareas', icon: 'format-list-checks' as const },
  { key: 'family', label: 'Familia', icon: 'account-group-outline' as const },
  { key: 'profile', label: 'Perfil', icon: 'account-outline' as const },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <BottomNavigation
          activeKey={state.routes[state.index]?.name ?? 'index'}
          items={tabs}
          onPress={(key) => navigation.navigate(key)}
        />
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="tasks" />
      <Tabs.Screen name="family" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
