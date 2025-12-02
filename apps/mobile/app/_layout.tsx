import { Stack } from 'expo-router';
import { ThemeProvider } from '@hos-marketplace/theme-system';

export default function RootLayout() {
  return (
    <ThemeProvider defaultThemeId="hos-default">
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTintColor: '#000000',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'House of Spells' }} />
        <Stack.Screen name="products" />
        <Stack.Screen name="cart" />
      </Stack>
    </ThemeProvider>
  );
}


