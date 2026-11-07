import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { developmentSessionAuth } from './src/development-auth';
import { listAssignments, type DriverAssignment } from './src/driver-api';

export default function App() {
  const [token, setToken] = useState('');
  const [assignments, setAssignments] = useState<DriverAssignment[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function connect() {
    setLoading(true);
    setError('');
    try {
      const page = await listAssignments(developmentSessionAuth(token));
      setAssignments(page.items);
    } catch (cause) {
      setAssignments(null);
      setError(cause instanceof Error ? cause.message : '任务读取失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.eyebrow}>DR ROUTEFIT</Text>
        <Text style={styles.title}>司机任务</Text>
        <Text style={styles.caption}>仅连接本机开发服务；正式登录由 RF-PM-055 替换。</Text>
      </View>

      <View style={styles.login}>
        <Text style={styles.label}>本机开发会话令牌</Text>
        <TextInput
          accessibilityLabel="本机开发会话令牌"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setToken}
          placeholder="仅保存在当前进程内"
          secureTextEntry
          style={styles.input}
          value={token}
        />
        <Pressable
          accessibilityRole="button"
          disabled={loading || token.trim().length < 32}
          onPress={connect}
          style={({ pressed }) => [
            styles.button,
            (loading || token.trim().length < 32) && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>{assignments ? '刷新任务' : '连接并读取任务'}</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator accessibilityLabel="正在读取任务" size="large" /> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {assignments ? (
        <FlatList
          contentContainerStyle={styles.list}
          data={assignments}
          keyExtractor={({ id }) => id}
          ListEmptyComponent={<Text style={styles.empty}>当前没有司机任务</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>任务 {item.id.slice(0, 8)}</Text>
              <Text style={styles.cardMeta}>订单 {item.orderId.slice(0, 8)}</Text>
              <Text style={styles.cardMeta}>状态 {item.state}</Text>
              <Text style={styles.cardMeta}>到期 {new Date(item.expiresAt).toLocaleString()}</Text>
            </View>
          )}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f6f8', padding: 24 },
  header: { gap: 6, marginBottom: 24 },
  eyebrow: { color: '#0f766e', fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
  title: { color: '#13233a', fontSize: 32, fontWeight: '700' },
  caption: { color: '#526174', fontSize: 14, lineHeight: 20 },
  login: { backgroundColor: '#ffffff', borderRadius: 16, gap: 12, marginBottom: 20, padding: 18 },
  label: { color: '#13233a', fontSize: 14, fontWeight: '600' },
  input: { borderColor: '#c8d1dc', borderRadius: 10, borderWidth: 1, color: '#13233a', padding: 12 },
  button: { alignItems: 'center', backgroundColor: '#153a63', borderRadius: 10, padding: 14 },
  buttonDisabled: { opacity: 0.4 },
  buttonPressed: { opacity: 0.75 },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  error: { backgroundColor: '#fee2e2', borderRadius: 10, color: '#991b1b', marginBottom: 16, padding: 12 },
  list: { gap: 12, paddingBottom: 24 },
  empty: { color: '#526174', paddingVertical: 24, textAlign: 'center' },
  card: { backgroundColor: '#ffffff', borderRadius: 14, gap: 5, padding: 16 },
  cardTitle: { color: '#13233a', fontSize: 17, fontWeight: '700' },
  cardMeta: { color: '#526174', fontSize: 14 },
});
