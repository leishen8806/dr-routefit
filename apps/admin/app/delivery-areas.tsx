import { StyleSheet, Text } from 'react-native';
import { AdminPage, Panel } from '../src/AdminPage';
import { deliveryAreaSummary } from '../src/admin-content.mjs';
export default function DeliveryAreasPage() { return <AdminPage description="区域规则在服务端验证。此页面仅显示待发布的本地示例，不会调用地图服务。" title="配送区域"><Panel title={deliveryAreaSummary.title}><Text style={styles.state}>{deliveryAreaSummary.publishState}</Text><Text style={styles.detail}>{deliveryAreaSummary.detail}</Text></Panel></AdminPage>; }
const styles = StyleSheet.create({ state: { color: '#A05A00', fontSize: 22, fontWeight: '600' }, detail: { color: '#59697A', fontSize: 15, lineHeight: 24, marginTop: 8 }, });
