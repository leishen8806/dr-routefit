import { Stack } from 'expo-router';
import { AdminShell } from '../src/AdminShell';

export default function RootLayout() {
  return <AdminShell><Stack screenOptions={{ headerShown: false }} /></AdminShell>;
}
