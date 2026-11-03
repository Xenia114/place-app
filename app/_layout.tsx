
import { Stack } from 'expo-router';
import { DatabaseProvider } from '../context/DatabaseContext';

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <Stack>
        <Stack.Screen
          name="index"
          options={{
            title: 'Мои места',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="marker/[id]"
          options={{
            title: 'Место',
            headerShown: true,
          }}
        />
      </Stack>
    </DatabaseProvider>
  );
}
