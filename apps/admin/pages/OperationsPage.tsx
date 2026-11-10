import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AdminPage, Panel } from '../src/AdminPage';
import { getOperationsPage, getOperationsRecord } from './operations-pages.mjs';

type OperationsPageProps = {
  pageId: string;
};

export function OperationsPage({ pageId }: OperationsPageProps) {
  const page = getOperationsPage(pageId);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!page) {
    return <AdminPage title="页面暂不可用" description="请选择已授权的管理后台业务页面。" />;
  }

  const selectedRecord = selectedIndex === null ? null : getOperationsRecord(pageId, selectedIndex);

  return <AdminPage title={page.title} description={page.description}>
    <Panel title="示例数据">
      <View style={styles.table} accessibilityRole="summary">
        <View style={[styles.row, styles.header]}>{page.columns.map((column: string) => <Text key={column} style={styles.headerText}>{column}</Text>)}</View>
        {page.rows.map((row: string[], index: number) => <Pressable key={`${page.id}-${index}`} accessibilityLabel={`${page.action}：${row[0]}`} accessibilityRole="button" onPress={() => setSelectedIndex(index)} style={styles.row}>{row.map((value: string, columnIndex: number) => <Text key={`${columnIndex}-${value}`} style={styles.cell}>{value}</Text>)}</Pressable>)}
      </View>
      <Text style={styles.note}>以下均为示例数据；当前页面操作均为纯前端，接入接口后替换。</Text>
    </Panel>
    {selectedRecord && <Panel title={`${selectedRecord.title}详情`}>
      <View accessibilityViewIsModal accessibilityRole="summary" style={styles.detail}>
        {selectedRecord.fields.map(([label, value]: [string, string]) => <View key={label} style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>)}
        <Pressable accessibilityLabel="关闭详情" accessibilityRole="button" onPress={() => setSelectedIndex(null)} style={styles.closeButton}><Text style={styles.closeButtonText}>关闭（纯前端）</Text></Pressable>
      </View>
    </Panel>}
  </AdminPage>;
}

const styles = StyleSheet.create({
  table: { gap: 1 },
  row: { backgroundColor: '#F8FAFC', flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 12 },
  header: { backgroundColor: '#EAF0F5' },
  headerText: { color: '#0B2545', flexGrow: 1, fontSize: 14, fontWeight: '600', minWidth: 108 },
  cell: { color: '#314559', flexGrow: 1, fontSize: 14, fontWeight: '400', lineHeight: 22, minWidth: 108 },
  note: { color: '#59697A', fontSize: 13, fontWeight: '400', lineHeight: 20, marginTop: 14 },
  detail: { gap: 12 },
  detailRow: { gap: 4 },
  detailLabel: { color: '#59697A', fontSize: 13, fontWeight: '500' },
  detailValue: { color: '#0B2545', fontSize: 16, fontWeight: '400', lineHeight: 24 },
  closeButton: { alignSelf: 'flex-start', backgroundColor: '#0B6B6B', borderRadius: 8, minHeight: 44, paddingHorizontal: 16, paddingVertical: 11 },
  closeButtonText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
