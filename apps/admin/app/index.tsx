import { StyleSheet, Text, View } from 'react-native';
import { AdminPage, Panel } from '../src/AdminPage';
import { dashboardMetrics } from '../src/admin-content.mjs';
export default function DashboardPage() { return <AdminPage description="汇总待处理工作与运营信号；所有指标均为示例，不代表实时生产数据。" title="运营看板"><View style={styles.grid}>{dashboardMetrics.map((metric) => <Panel key={metric.label} title={metric.label}><Text style={styles.value}>{metric.value}</Text><Text style={styles.detail}>{metric.detail}</Text></Panel>)}</View><Panel title="今日优先事项"><Text style={styles.detail}>示例 · 先处理超出承诺时段的订单，再由调度员确认建议方案。</Text></Panel></AdminPage>; }
const styles = StyleSheet.create({ grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, value: { color: '#0B2545', fontSize: 32, fontWeight: '600' }, detail: { color: '#59697A', fontSize: 14, lineHeight: 22, marginTop: 6 }, });
