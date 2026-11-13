import { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { designTokens } from '@routefit/shared';

export function AdminPage({ children, description, title }: PropsWithChildren<{ title: string; description: string }>) {
  return <ScrollView contentContainerStyle={styles.page}><Text style={styles.eyebrow}>示例 · 本地模拟数据</Text><Text style={styles.title}>{title}</Text><Text style={styles.description}>{description}</Text>{children}</ScrollView>;
}
export function Panel({ children, title }: PropsWithChildren<{ title: string }>) { return <View style={styles.panel}><Text style={styles.panelTitle}>{title}</Text>{children}</View>; }
const styles = StyleSheet.create({ page: { gap: 16, padding: 32 }, eyebrow: { color: designTokens.color.teal, fontSize: 13, fontWeight: '600' }, title: { color: designTokens.color.navy, fontSize: 30, fontWeight: '600' }, description: { color: designTokens.color.muted, fontSize: 16, lineHeight: 26, maxWidth: 760 }, panel: { backgroundColor: '#FFF', borderColor: designTokens.color.line, borderRadius: 16, borderWidth: 1, padding: 20 }, panelTitle: { color: designTokens.color.navy, fontSize: 17, fontWeight: '600', marginBottom: 12 }, });
