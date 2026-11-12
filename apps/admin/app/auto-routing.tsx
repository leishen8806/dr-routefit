import { StyleSheet, Text } from 'react-native';
import { AdminPage, Panel } from '../src/AdminPage';
import { autoRoutingSummary } from '../src/admin-content.mjs';
export default function AutoRoutingPage() { return <AdminPage description="自动排线只生成可审阅建议；它不会直接写入订单、司机或余额。" title="自动排线"><Panel title={autoRoutingSummary.title}><Text style={styles.status}>{autoRoutingSummary.status}</Text><Text style={styles.detail}>{autoRoutingSummary.detail}</Text></Panel></AdminPage>; }
const styles = StyleSheet.create({ status: { color: '#0B2545', fontSize: 22, fontWeight: '600' }, detail: { color: '#59697A', fontSize: 15, lineHeight: 24, marginTop: 8 }, });
