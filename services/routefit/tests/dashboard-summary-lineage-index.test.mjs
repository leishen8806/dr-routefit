import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const index = new URL('../../../contracts/rf-ux-v1-r2-api-index.md', import.meta.url);

test('dashboard summary has one documented source and computation rule per demo metric', async () => {
  const content = await readFile(index, 'utf8');
  const metrics={
    pendingDispatchOrderCount:['orders.draft','awaiting_dispatch'],
    pendingDispatchOrderDeltaVsYesterday:['orders.draft_revision','去重'],
    availableDriverCount:['Backend2 070','示例'],
    driversPendingConfirmationCount:['Backend2 070','示例'],
    onTimeDeliveryRatePercent:['delivery.record','示例'],
    onTimeDeliveryRateWindowDays:['DashboardSummary','示例'],
    actionRequiredExceptionCount:['casework.dispatch_exception','open']
  };
  const verify=lineage=>{
    for (const [field,terms] of Object.entries(metrics)) {
      const line=lineage.split(/\r?\n/).find(candidate=>candidate.startsWith('| `'+field+'` |'));
      assert.ok(line, `missing lineage for ${field}`);
      const cells=line.split('|').slice(1,-1).map(cell=>cell.trim());
      assert.equal(cells.length,5, `${field} must have five lineage columns`);
      cells.forEach((cell,index)=>assert.ok(cell, `${field} has an empty lineage column ${index+1}`));
      for (const term of terms) assert.match(line, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')), `${field} lacks ${term}`);
    }
  };
  verify(content);
  for (const field of Object.keys(metrics)) {
    const withoutMetric=content.split(/\r?\n/).filter(line=>!line.startsWith('| `'+field+'` |')).join('\n');
    assert.throws(()=>verify(withoutMetric), new RegExp(`missing lineage for ${field}`));
  }
  for (const field of Object.keys(metrics)) {
    for (let column=1;column<=4;column++) {
      const withoutCell=content.split(/\r?\n/).map(line=>{
        if (!line.startsWith('| `'+field+'` |')) return line;
        const cells=line.split('|');
        cells[column+1]='';
        return cells.join('|');
      }).join('\n');
      assert.throws(()=>verify(withoutCell));
    }
  }
});

test('open authentication injection contract documents the implementation handoff to OpsLead', async () => {
  const content = await readFile(index, 'utf8');
  for (const term of ['openAuthenticate(request)', 'subjectId', 'scopes', 'apiKeyId', 'integration.api_key', 'integration.api_call_log', 'CMP-1326']) assert.match(content, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
