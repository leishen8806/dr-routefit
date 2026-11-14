import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { designTokens } from '@routefit/shared';
import { AdminPage, Panel } from '../src/AdminPage';
import {
  getOperationsDrawerAccessibility,
  getOperationsPage,
  getOperationsRecord,
  getOperationsRows,
} from './operations-pages.mjs';
import { ORDER_DEMO_ROWS, ORDER_STATUS_FILTERS } from './orders-demo.mjs';

type OperationsPageProps = {
  pageId: string;
  configuredPages?: Record<string, unknown>;
};

export function OperationsPage({ pageId, configuredPages }: OperationsPageProps) {
  const page = getOperationsPage(pageId, configuredPages);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [orderFilter, setOrderFilter] = useState('all');

  if (!page) {
    return <AdminPage title="页面暂不可用" description="请选择已授权的管理后台业务页面。" />;
  }

  const rows = getOperationsRows(pageId, configuredPages);
  const hasRejectedRows = page.rows.length !== rows.length;
  const selectedRecord = selectedIndex === null ? null : getOperationsRecord(pageId, selectedIndex, configuredPages);
  const drawerAccessibility = selectedRecord ? getOperationsDrawerAccessibility(pageId, configuredPages) : null;
  const isOrders = pageId === 'orders' && configuredPages === undefined;
  const visibleRows = isOrders
    ? rows.filter(({ index }: { index: number }) => orderFilter === 'all' || ORDER_DEMO_ROWS[index]?.[8] === orderFilter)
    : rows;

  return <AdminPage title={page.title} description={page.description}>
    <Panel title="示例数据">
      {isOrders && <View accessibilityRole="tablist" style={styles.filters}>
        {ORDER_STATUS_FILTERS.map(([value, label]) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: orderFilter === value }} onPress={() => setOrderFilter(value)} style={[styles.filter, orderFilter === value && styles.filterSelected]}><Text style={[styles.filterText, orderFilter === value && styles.filterTextSelected]}>{label}</Text></Pressable>)}
      </View>}
      <View style={styles.table} accessibilityRole="summary">
        <View style={[styles.row, styles.header]}>{page.columns.map((column: string) => <Text key={column} style={styles.headerText}>{column}</Text>)}</View>
        {visibleRows.map(({ row, index }: { row: string[]; index: number }) => <Pressable key={`${page.id}-${index}`} accessibilityLabel={`${page.action}：${row[0]}`} accessibilityRole="button" onPress={() => setSelectedIndex(index)} style={styles.row}>{row.map((value: string, columnIndex: number) => <Text key={`${columnIndex}-${value}`} style={styles.cell}>{value}</Text>)}</Pressable>)}
      </View>
      {hasRejectedRows && <Text accessibilityRole="alert" style={styles.unavailable}>部分配置记录暂不可用，已从列表中隐藏。</Text>}
      <Text style={styles.note}>以下均为示例数据；订单号、金额与时间均为示例，当前页面操作均为纯前端。</Text>
    </Panel>
    {selectedRecord && <Panel title={`${selectedRecord.title}详情`}>
      <View role="dialog" aria-modal={true} accessibilityHint="演示数据（示例）；当前操作为纯前端。" accessibilityLabel={drawerAccessibility?.accessibilityLabel} accessibilityViewIsModal={drawerAccessibility?.isModal} style={styles.detail}>
        {selectedRecord.fields.map(([label, value]: [string, string]) => <View key={label} style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>)}
        <Pressable accessibilityLabel="关闭详情" accessibilityRole="button" onPress={() => setSelectedIndex(null)} style={styles.closeButton}><Text style={styles.closeButtonText}>关闭（纯前端）</Text></Pressable>
      </View>
    </Panel>}
  </AdminPage>;
}

const styles = StyleSheet.create({
  table: { gap: 1 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  filter: { borderColor: designTokens.color.muted, borderRadius: 999, borderWidth: 1, minHeight: 36, paddingHorizontal: 12, paddingVertical: 8 },
  filterSelected: { backgroundColor: designTokens.color.navy, borderColor: designTokens.color.navy },
  filterText: { color: designTokens.color.navy, fontSize: 13, fontWeight: '600' },
  filterTextSelected: { color: designTokens.color.surface },
  row: { backgroundColor: designTokens.color.surface, flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 12 },
  header: { backgroundColor: designTokens.color.background },
  headerText: { color: designTokens.color.navy, flexGrow: 1, fontSize: 14, fontWeight: '600', minWidth: 108 },
  cell: { color: designTokens.color.ink, flexGrow: 1, fontSize: 14, fontWeight: '400', lineHeight: 22, minWidth: 108 },
  note: { color: designTokens.color.muted, fontSize: 13, fontWeight: '400', lineHeight: 20, marginTop: 14 },
  unavailable: { color: designTokens.color.navy, fontSize: 13, fontWeight: '500', lineHeight: 20, marginTop: 12 },
  detail: { gap: 12 },
  detailRow: { gap: 4 },
  detailLabel: { color: designTokens.color.muted, fontSize: 13, fontWeight: '500' },
  detailValue: { color: designTokens.color.navy, fontSize: 16, fontWeight: '400', lineHeight: 24 },
  closeButton: { alignSelf: 'flex-start', backgroundColor: designTokens.color.navy, borderRadius: 8, minHeight: 44, paddingHorizontal: 16, paddingVertical: 11 },
  closeButtonText: { color: designTokens.color.surface, fontSize: 14, fontWeight: '600' },
});
