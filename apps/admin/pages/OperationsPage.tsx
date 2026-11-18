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
import { ORDER_DEMO_ROWS, ORDER_DETAIL_RECIPIENTS, ORDER_DETAIL_TIMELINES, ORDER_STATUS_FILTERS } from './orders-demo.mjs';

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
  const selectedOrder = isOrders && selectedIndex !== null ? ORDER_DEMO_ROWS[selectedIndex] : null;
  const orderTimeline = isOrders && selectedIndex !== null ? ORDER_DETAIL_TIMELINES[selectedIndex] : null;
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
        {visibleRows.map(({ row, index }: { row: string[]; index: number }) => <Pressable key={`${page.id}-${index}`} accessibilityLabel={`${page.action}：${row[0]}`} accessibilityRole="button" onPress={() => setSelectedIndex(index)} style={styles.row}>{row.map((value: string, columnIndex: number) => <Text key={`${columnIndex}-${value}`} style={[styles.cell, isOrders && columnIndex === 3 && styles.statusTag]}>{value}</Text>)}</Pressable>)}
      </View>
      {hasRejectedRows && <Text accessibilityRole="alert" style={styles.unavailable}>部分配置记录暂不可用，已从列表中隐藏。</Text>}
      <Text style={styles.note}>以下均为示例数据；订单号、金额与时间均为示例，当前页面操作均为纯前端。</Text>
    </Panel>
    {selectedRecord && <Panel title={selectedOrder ? selectedOrder[0] : `${selectedRecord.title}详情`}>
      <View role="dialog" aria-modal={true} accessibilityHint="演示数据（示例）；当前操作为纯前端。" accessibilityLabel={drawerAccessibility?.accessibilityLabel} accessibilityViewIsModal={drawerAccessibility?.isModal} style={styles.detail}>
        {selectedOrder && orderTimeline ? <>
          <View style={styles.orderMeta}><Text style={styles.statusTag}>{selectedOrder[3]}</Text><Text style={styles.meta}>{selectedOrder[1]}</Text></View>
          {[
            ['收件人', ORDER_DETAIL_RECIPIENTS[selectedIndex!]],
            ['司机', selectedOrder[4]],
            ['运费', selectedOrder[5]],
            ['代收货款', selectedOrder[6] === '—' ? '无（示例）' : selectedOrder[6]],
          ].map(([label, value]) => <View key={label} style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>)}
          <View><Text style={styles.recordTitle}>记录</Text>{orderTimeline.map(([message, time]) => <View key={time} style={styles.timelineRow}><Text style={styles.timelineDot}>•</Text><View><Text style={styles.detailValue}>{message}</Text><Text style={styles.timelineTime}>{time}</Text></View></View>)}</View>
          {selectedOrder[8] === 'plain' && <Pressable accessibilityLabel="去调度台派车" accessibilityRole="button" style={styles.dispatchButton}><Text style={styles.closeButtonText}>去调度台派车（示例）</Text></Pressable>}
        </> : selectedRecord.fields.map(([label, value]: [string, string]) => <View key={label} style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>)}
        <Pressable accessibilityLabel="关闭" accessibilityRole="button" onPress={() => setSelectedIndex(null)} style={styles.closeButton}><Text style={styles.closeButtonText}>关闭</Text></Pressable>
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
  statusTag: { alignSelf: 'flex-start', backgroundColor: designTokens.color.background, borderColor: designTokens.color.muted, borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
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
  orderMeta: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  meta: { color: designTokens.color.muted, fontSize: 14, fontWeight: '400' },
  recordTitle: { color: designTokens.color.navy, fontSize: 16, fontWeight: '600', marginBottom: 8 },
  timelineRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  timelineDot: { color: designTokens.color.navy, fontSize: 18, lineHeight: 22 },
  timelineTime: { color: designTokens.color.muted, fontSize: 13, lineHeight: 20 },
  dispatchButton: { alignSelf: 'flex-start', backgroundColor: designTokens.color.teal, borderRadius: 8, minHeight: 44, paddingHorizontal: 16, paddingVertical: 11 },
  closeButton: { alignSelf: 'flex-start', backgroundColor: designTokens.color.navy, borderRadius: 8, minHeight: 44, paddingHorizontal: 16, paddingVertical: 11 },
  closeButtonText: { color: designTokens.color.surface, fontSize: 14, fontWeight: '600' },
});
