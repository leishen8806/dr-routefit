import { StyleSheet, Text, View } from 'react-native';
import { AdminPage, Panel } from '../src/AdminPage';
export default function DispatchPage() { return <AdminPage description="调度员在此审阅订单队列、运力和建议路线；当前不连接地图或真实派单接口。" title="调度台"><Panel title="待调度订单"><View style={styles.row}><Text style={styles.order}>RF-DEMO-018</Text><Text style={styles.status}>待确认 · 示例</Text></View><Text style={styles.copy}>服务区域已匹配；司机分配仍须由具备权限的服务端操作确认。</Text></Panel></AdminPage>; }
const styles = StyleSheet.create({ row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, order: { color: '#0B2545', fontSize: 18, fontWeight: '600' }, status: { color: '#087861', fontSize: 14, fontWeight: '500' }, copy: { color: '#59697A', fontSize: 15, lineHeight: 24, marginTop: 12 }, });
