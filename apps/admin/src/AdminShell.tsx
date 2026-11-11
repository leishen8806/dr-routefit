import { Link, usePathname } from 'expo-router';
import { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { designTokens } from '@routefit/shared';
import { adminNavigation } from './navigation.mjs';

export function AdminShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  return <View style={styles.frame}><View style={styles.sidebar}><Text style={styles.brand}>DR RouteFit</Text><Text style={styles.caption}>运营管理后台</Text><View accessibilityRole="navigation" style={styles.nav}>
    {adminNavigation.map((item) => <Link asChild href={item.href} key={item.id}><Pressable accessibilityRole="link" style={[styles.item, pathname === item.href && styles.itemActive]}><Text style={[styles.itemText, pathname === item.href && styles.itemTextActive]}>{item.label}</Text></Pressable></Link>)}
  </View><Text style={styles.footer}>示例数据 · 权限与金额校验由服务端执行</Text></View><View style={styles.main}>{children}</View></View>;
}

const styles = StyleSheet.create({
  frame: { backgroundColor: '#F3F5F7', flex: 1, flexDirection: 'row', minHeight: '100%' }, sidebar: { backgroundColor: designTokens.color.navy, minHeight: '100%', padding: 24, width: 236 }, brand: { color: '#FFF', fontSize: 20, fontWeight: '600' }, caption: { color: '#B7C8D8', fontSize: 13, marginTop: 4 }, nav: { gap: 2, marginTop: 30 }, item: { borderRadius: 8, justifyContent: 'center', minHeight: 40, paddingHorizontal: 12 }, itemActive: { backgroundColor: '#17456F' }, itemText: { color: '#D9E6EF', fontSize: 14, fontWeight: '500' }, itemTextActive: { color: '#FFF' }, footer: { bottom: 24, color: '#B7C8D8', fontSize: 12, left: 24, lineHeight: 20, position: 'absolute', right: 24 }, main: { flex: 1, minWidth: 0 },
});
