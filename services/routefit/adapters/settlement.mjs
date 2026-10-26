import {createHmac,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {ensure} from '../domain/errors.mjs';
import {currentCustomer} from './orders.mjs';
import {driverIdentity} from './driver.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cursorKey=randomBytes(32),sign=value=>createHmac('sha256',cursorKey).update(value).digest('base64url');
const DAY=86400000,MAX=9000000000000n;
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const date=value=>Date.parse(value+'T00:00:00Z');
const plusDays=(value,days)=>new Date(date(value)+days*DAY).toISOString().slice(0,10);
const money=value=>{const n=BigInt(value);ensure(n>=0n&&n<=MAX,500,'INVALID_STATEMENT_BALANCE','账单金额数据无效');return Number(n);};

function page(url,principal,kind,subjectId=null){
 for(const key of url.searchParams.keys())ensure((subjectId===null?['limit','cursor']:['limit','cursor','subjectId']).includes(key)&&url.searchParams.getAll(key).length===1,422,'INVALID_QUERY','查询参数不支持或重复');
 const limit=Number(url.searchParams.get('limit')??50);ensure(Number.isInteger(limit)&&limit>=1&&limit<=100,422,'INVALID_LIMIT','limit须为1到100');
 const binding=JSON.stringify([kind,principal.companyId,principal.principalId,limit,subjectId]),token=url.searchParams.get('cursor');let after=null;
 if(token!==null){try{const [payload,signature,...rest]=token.split('.');ensure(token.length<=2048&&signature&&rest.length===0&&signature.length===43&&timingSafeEqual(Buffer.from(signature),Buffer.from(sign(payload))),422,'INVALID_CURSOR','游标无效或已失效');const decoded=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));ensure(decoded.binding===binding&&decoded.expiresAt>Date.now()&&uuid.test(decoded.after),422,'INVALID_CURSOR','游标无效或已失效');after=decoded.after;}catch{ensure(false,422,'INVALID_CURSOR','游标无效或已失效');}}
 return {limit,after,cursor:id=>{const payload=Buffer.from(JSON.stringify({binding,after:id,expiresAt:Date.now()+3600000})).toString('base64url');return payload+'.'+sign(payload)}};
}
export const settlementRuleQuery=(url,p)=>page(url,p,'settlement-rules');
export const statementQuery=(url,p)=>page(url,p,'statements');
export const customerStatementQuery=(url,p)=>page(url,p,'customer-statements');
export const customerSettlementAccountQuery=(url,p)=>page(url,p,'customer-settlement-accounts');
export const driverSettlementAccountQuery=(url,p)=>page(url,p,'driver-settlement-accounts');
export const driverWithdrawalQuery=(url,p)=>page(url,p,'driver-withdrawal-requests');
export const opsSettlementAccountQuery=(url,p)=>{const subjectId=url.searchParams.get('subjectId');ensure(uuid.test(subjectId??''),422,'INVALID_QUERY','对象ID无效');return {...page(url,p,'ops-settlement-accounts',subjectId),subjectId};};
export const customerFinanceRequestQuery=(url,p)=>page(url,p,'customer-finance-requests');

function ruleCheck(rule){
 ensure(uuid.test(rule.subjectId)&&uuid.test(rule.ownerPersonId),422,'INVALID_SETTLEMENT_RULE','结算对象或负责人无效');
 ensure(['RECEIVABLE','PAYABLE'].includes(rule.direction)&&['DELIVERY','INSURANCE','COD','CARRIER','DRIVER_INCOME','WAREHOUSE'].includes(rule.purpose)&&['USD','KHR'].includes(rule.currency),422,'INVALID_SETTLEMENT_RULE','结算规则枚举值无效');
 ensure(['PER_ORDER','DAILY','WEEKLY','MONTHLY','EVERY_N_DAYS'].includes(rule.period),422,'INVALID_SETTLEMENT_RULE','结算周期无效');
 for(const field of ['anchorDate','effectiveFrom'])ensure(validDate(rule[field]),422,'INVALID_SETTLEMENT_RULE','结算日期无效');
 ensure(rule.effectiveFrom>=rule.anchorDate,422,'INVALID_SETTLEMENT_RULE','生效日不得早于周期锚点');
 ensure(['MONTH_END','NEXT_VALID_MONTH'].includes(rule.shortMonthPolicy),422,'INVALID_SETTLEMENT_RULE','短月规则无效');
 for(const field of ['issueDelayDays','dueAfterDays','remindBeforeDays'])ensure(Number.isInteger(rule[field])&&rule[field]>=0&&rule[field]<=366,422,'INVALID_SETTLEMENT_RULE','结算天数无效');
 ensure(Number.isInteger(rule.overdueRepeatDays)&&rule.overdueRepeatDays>=1&&rule.overdueRepeatDays<=366,422,'INVALID_SETTLEMENT_RULE','催收间隔无效');
 if(rule.period==='EVERY_N_DAYS')ensure(Number.isInteger(rule.intervalDays)&&rule.intervalDays>=1&&rule.intervalDays<=366,422,'INVALID_SETTLEMENT_RULE','间隔天数无效');
 if(rule.period==='WEEKLY')ensure(Number.isInteger(rule.weekDay)&&rule.weekDay>=1&&rule.weekDay<=7,422,'INVALID_SETTLEMENT_RULE','周结日无效');
 if(rule.period==='MONTHLY')ensure(Number.isInteger(rule.monthDay)&&rule.monthDay>=1&&rule.monthDay<=31,422,'INVALID_SETTLEMENT_RULE','月结日无效');
 return rule;
}
function monthEnd(year,month){return new Date(Date.UTC(year,month,0)).getUTCDate();}
function periodEnd(rule,start){
 if(rule.period==='PER_ORDER'||rule.period==='DAILY')return plusDays(start,1);
 if(rule.period==='EVERY_N_DAYS')return plusDays(start,rule.intervalDays);
 if(rule.period==='WEEKLY'){const iso=((new Date(date(start)).getUTCDay()+6)%7)+1;return plusDays(start,(rule.weekDay-iso+7)%7+1);}
 const d=new Date(date(start));let year=d.getUTCFullYear(),month=d.getUTCMonth()+1;
 for(let index=0;index<24;index++){const last=monthEnd(year,month);if(rule.monthDay<=last||rule.shortMonthPolicy==='MONTH_END'){const day=rule.monthDay<=last?rule.monthDay:last,end=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;if(end>=start)return plusDays(end,1);}month++;if(month===13){month=1;year++;}}
 ensure(false,422,'INVALID_SETTLEMENT_RULE','无法计算月度结算周期');
}
export function settlementPeriods(rule,count=3){
 ruleCheck(rule);let start=rule.anchorDate;const items=[];
 for(let index=0;index<count;index++){const endExclusive=periodEnd(rule,start),issueDate=plusDays(endExclusive,rule.issueDelayDays),dueDate=plusDays(issueDate,rule.dueAfterDays);items.push({start,endExclusive,issueDate,dueDate});start=endExclusive;}
 return items;
}
function scheduleMatches(rule,start,endExclusive){
 if(start<rule.anchorDate)return false;let cursor=rule.anchorDate;
 for(let index=0;index<10000&&cursor<=start;index++){const end=periodEnd(rule,cursor);if(cursor===start)return end===endExclusive;cursor=end;}
 return false;
}
async function person(client,principal){const row=(await client.query("SELECT person_id FROM org.principal WHERE company_id=$1 AND id=$2 AND status='ACTIVE'",[principal.companyId,principal.principalId])).rows[0];ensure(row?.person_id,403,'FINANCE_PERSON_REQUIRED','当前会话缺少有效自然人身份');return row.person_id;}
async function activeOwner(client,principal,personId){const found=(await client.query("SELECT 1 FROM org.principal WHERE company_id=$1 AND person_id=$2 AND kind='STAFF' AND status='ACTIVE'",[principal.companyId,personId])).rowCount;ensure(found,422,'SETTLEMENT_OWNER_INVALID','负责人不是有效员工');}
async function evidence(client,principal,ids){ensure(new Set(ids).size===ids.length,422,'DUPLICATE_EVIDENCE','证据不得重复');const found=(await client.query("SELECT count(*)::integer AS count FROM evidence.file WHERE company_id=$1 AND id=ANY($2::uuid[]) AND state='available'",[principal.companyId,ids])).rows[0].count;ensure(found===ids.length,422,'EVIDENCE_UNAVAILABLE','证据不存在或未完成');}
function ruleView(row){return {id:row.id,version:Number(row.version),state:row.state,rule:row.rule};}
function accountView(row){return {id:row.id,version:Number(row.version),subjectId:row.subject_id,bankCode:row.bank_code,last4:row.last4,holderDisplayName:row.holder_display_name,state:row.state};}
function financeRequestView(row){return {id:row.id,version:Number(row.version),kind:'REFUND',state:'submitted',money:{amountMinor:Number(row.money_amount_minor),currency:row.money_currency},sourceIds:[row.generic_receipt_id??row.prepayment_receipt_id],nextAction:'退款申请已提交，等待独立复核。',updatedAt:new Date(row.created_at).toISOString()};}
function driverWithdrawalView(row){return {id:row.id,version:Number(row.version),kind:'PAYMENT',state:'submitted',money:{amountMinor:Number(row.money_amount_minor),currency:row.money_currency},sourceIds:[row.ledger_item_id],nextAction:'提现申请已提交，等待独立复核和审批。',updatedAt:new Date(row.created_at).toISOString()};}
async function ruleRow(client,principal,id,lock=false){ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');const row=(await client.query('SELECT * FROM finance.settlement_rule WHERE company_id=$1 AND id=$2'+(lock?' FOR UPDATE':''),[principal.companyId,id])).rows[0];ensure(row,404,'NOT_FOUND','资源不存在');return row;}
async function statementRow(client,principal,id,lock=false){ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');const row=(await client.query('SELECT * FROM finance.statement WHERE company_id=$1 AND id=$2'+(lock?' FOR UPDATE':''),[principal.companyId,id])).rows[0];ensure(row,404,'NOT_FOUND','资源不存在');return row;}
async function ledgerItem(client,principal,row){
 if(row.source==='AMENDMENT')return {...row.snapshot,version:1,allocatedMinor:money(row.snapshot.allocatedMinor??0),outstandingMinor:money(row.snapshot.outstandingMinor??row.snapshot.originalMinor)};
 const allocated=BigInt((await client.query("SELECT COALESCE(sum((line->>'amountMinor')::bigint),0) AS total FROM finance.prepayment_allocation a JOIN finance.allocation_event e ON (a.company_id,a.id)=(e.company_id,e.allocation_id) CROSS JOIN LATERAL jsonb_array_elements(a.snapshot->'lines') line WHERE a.company_id=$1 AND a.quote_id=$2 AND line->>'feeId'=$3 AND e.action='POSTED' AND NOT EXISTS(SELECT 1 FROM finance.reversal_event r WHERE r.company_id=a.company_id AND r.allocation_id=a.id AND r.action='POSTED')",[principal.companyId,row.quote_id,row.fee_id])).rows[0].total);
 const original=BigInt(row.snapshot.originalMinor),outstanding=original>allocated?original-allocated:0n;return {...row.snapshot,version:1,allocatedMinor:money(allocated),outstandingMinor:money(outstanding)};
}
async function selectableLedgerRows(client,principal,rule,periodEndExclusive){
 const args=[principal.companyId,rule.subjectId,rule.direction,rule.purpose,rule.currency,periodEndExclusive];
 const base=(await client.query("SELECT l.id,l.quote_id,l.fee_id,l.snapshot,'BASE' AS source FROM finance.ledger_item l WHERE l.company_id=$1 AND l.snapshot->>'subjectId'=$2::text AND l.snapshot->>'direction'=$3 AND l.snapshot->>'purpose'=$4 AND l.snapshot->>'currency'=$5 AND l.snapshot->>'dueDate'<$6 AND NOT EXISTS(SELECT 1 FROM finance.statement_line sl WHERE sl.company_id=l.company_id AND sl.ledger_item_id=l.id) FOR UPDATE",args)).rows;
 const amendment=(await client.query("SELECT l.id,NULL::uuid AS quote_id,NULL::uuid AS fee_id,l.snapshot,'AMENDMENT' AS source FROM finance.amendment_ledger_adjustment l WHERE l.company_id=$1 AND l.snapshot->>'subjectId'=$2::text AND l.snapshot->>'direction'=$3 AND l.snapshot->>'purpose'=$4 AND l.snapshot->>'currency'=$5 AND l.snapshot->>'dueDate'<$6 AND NOT EXISTS(SELECT 1 FROM finance.statement_line sl WHERE sl.company_id=l.company_id AND sl.ledger_item_id=l.id) FOR UPDATE",args)).rows;
 return [...base,...amendment];
}
async function statementView(client,principal,row){
 const lines=(await client.query('SELECT ledger_item_id,ledger_item_version,snapshot FROM finance.statement_line WHERE company_id=$1 AND statement_id=$2 ORDER BY ledger_item_id',[principal.companyId,row.id])).rows;
 const snapshot=row.snapshot;let allocated=0n,closing=0n;
 for(const line of lines){const amendment=line.snapshot.source==='AMENDMENT',sql=amendment?"SELECT id,NULL::uuid AS quote_id,NULL::uuid AS fee_id,snapshot,'AMENDMENT' AS source FROM finance.amendment_ledger_adjustment WHERE company_id=$1 AND id=$2":"SELECT id,quote_id,fee_id,snapshot,'BASE' AS source FROM finance.ledger_item WHERE company_id=$1 AND id=$2",currentRow=(await client.query(sql,[principal.companyId,line.ledger_item_id])).rows[0];ensure(currentRow,500,'STATEMENT_LEDGER_MISSING','账单关联账项缺失');const current=await ledgerItem(client,principal,currentRow);allocated+=BigInt(line.snapshot.originalMinor)+BigInt(line.snapshot.adjustmentMinor??0)-BigInt(current.outstandingMinor);closing+=BigInt(current.outstandingMinor);}
 const charges=BigInt(snapshot.chargesMinor),opening=BigInt(snapshot.openingMinor),adjustment=BigInt(snapshot.adjustmentMinor);
 const total=opening+charges+adjustment;const paymentState=closing===0n?'settled':closing===total?'unpaid':'partial';
 return {id:row.id,version:Number(row.version),subjectId:row.subject_id,direction:row.direction,currency:row.currency,periodStart:row.period_start.toISOString().slice(0,10),periodEndExclusive:row.period_end_exclusive.toISOString().slice(0,10),ruleVersionId:row.rule_id,ledgerItems:lines.map(line=>({id:line.ledger_item_id,version:Number(line.ledger_item_version)})),openingMinor:money(opening),chargesMinor:money(charges),adjustmentMinor:Number(adjustment),allocatedMinor:money(allocated),closingMinor:money(closing),dueDate:row.due_date.toISOString().slice(0,10),internalState:row.internal_state,customerState:row.customer_state??'unseen',paymentState};
}
export async function readSettlement(client,principal,kind,id,query){
 if(kind==='settlement-rule')return ruleView(await ruleRow(client,principal,id));
 if(kind==='statement')return statementView(client,principal,await statementRow(client,principal,id));
 if(kind==='settlement-rules'){const rows=(await client.query('SELECT * FROM finance.settlement_rule WHERE company_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3',[principal.companyId,query.after,query.limit+1])).rows,selected=rows.slice(0,query.limit);return {items:selected.map(ruleView),nextCursor:rows.length>query.limit?query.cursor(selected.at(-1).id):null};}
 ensure(kind==='statements',500,'INVALID_ROUTE','未实现的结算读取');const rows=(await client.query('SELECT * FROM finance.statement WHERE company_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3',[principal.companyId,query.after,query.limit+1])).rows,selected=rows.slice(0,query.limit),items=[];for(const row of selected)items.push(await statementView(client,principal,row));return {items,nextCursor:rows.length>query.limit?query.cursor(selected.at(-1).id):null};
}
export async function writeSettlement(client,principal,kind,id,input,version){
 if(kind==='settlement-rule-create'){
  const rule=ruleCheck(input),maker=await person(client,principal);await activeOwner(client,principal,rule.ownerPersonId);const result={id:randomUUID(),version:1,state:'draft',rule};
  await client.query('INSERT INTO finance.settlement_rule(id,company_id,subject_id,direction,purpose,currency,state,version,rule,maker_principal_id,maker_person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[result.id,principal.companyId,rule.subjectId,rule.direction,rule.purpose,rule.currency,result.state,result.version,rule,principal.principalId,maker,result]);
  await client.query("INSERT INTO finance.settlement_rule_event(company_id,rule_id,version,action,principal_id,person_id,snapshot) VALUES($1,$2,1,'CREATED',$3,$4,$5)",[principal.companyId,result.id,principal.principalId,maker,{reason:'created',recordedAt:new Date().toISOString()}]);return result;
 }
 if(kind==='settlement-rule-preview'){return {items:settlementPeriods(input,3),nextCursor:null};}
 if(kind==='settlement-rule-activate'){
  const row=await ruleRow(client,principal,id,true),actor=await person(client,principal);ensure(Number(row.version)===version,412,'VERSION_CONFLICT','结算规则已变化，请重新查询');ensure(row.state==='draft',409,'RULE_NOT_ACTIVATABLE','当前结算规则不可生效');ensure(actor!==row.maker_person_id,403,'INDEPENDENT_RULE_APPROVAL_REQUIRED','规则批准人必须与创建人不同');await evidence(client,principal,input.evidenceFileIds);
  const next={id:row.id,version:Number(row.version)+1,state:'active',rule:row.rule};const old=(await client.query("SELECT * FROM finance.settlement_rule WHERE company_id=$1 AND subject_id=$2 AND direction=$3 AND purpose=$4 AND currency=$5 AND state='active' FOR UPDATE",[principal.companyId,row.subject_id,row.direction,row.purpose,row.currency])).rows;
  for(const prior of old){const superseded={id:prior.id,version:Number(prior.version)+1,state:'superseded',rule:prior.rule};await client.query('UPDATE finance.settlement_rule SET state=$3,version=$4,snapshot=$5,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2',[principal.companyId,prior.id,superseded.state,superseded.version,superseded]);await client.query("INSERT INTO finance.settlement_rule_event(company_id,rule_id,version,action,principal_id,person_id,snapshot) VALUES($1,$2,$3,'SUPERSEDED',$4,$5,$6)",[principal.companyId,prior.id,superseded.version,principal.principalId,actor,{reason:'replaced by '+row.id,recordedAt:new Date().toISOString()}]);}
  await client.query('UPDATE finance.settlement_rule SET state=$3,version=$4,snapshot=$5,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2',[principal.companyId,row.id,next.state,next.version,next]);await client.query("INSERT INTO finance.settlement_rule_event(company_id,rule_id,version,action,principal_id,person_id,snapshot) VALUES($1,$2,$3,'ACTIVATED',$4,$5,$6)",[principal.companyId,row.id,next.version,principal.principalId,actor,{reason:input.reason.trim(),evidenceFileIds:input.evidenceFileIds,recordedAt:new Date().toISOString()}]);return next;
 }
 if(kind==='statement-generate'){
  ensure(validDate(input.periodStart)&&validDate(input.periodEndExclusive)&&input.periodEndExclusive>input.periodStart,422,'INVALID_PERIOD','账期无效');const ruleRowValue=await ruleRow(client,principal,input.ruleId,true),rule=ruleRowValue.rule;ensure(ruleRowValue.state==='active'&&Number(ruleRowValue.version)===input.ruleVersion,412,'RULE_VERSION_CONFLICT','结算规则不是当前生效版本');ensure(scheduleMatches(rule,input.periodStart,input.periodEndExclusive),422,'PERIOD_NOT_MATCHED','账期不符合结算规则');
  const existing=(await client.query('SELECT * FROM finance.statement WHERE company_id=$1 AND subject_id=$2 AND direction=$3 AND currency=$4 AND rule_id=$5 AND period_start=$6 AND period_end_exclusive=$7 AND revision=1',[principal.companyId,rule.subjectId,rule.direction,rule.currency,input.ruleId,input.periodStart,input.periodEndExclusive])).rows[0];if(existing)return statementView(client,principal,existing);
  const rows=await selectableLedgerRows(client,principal,rule,input.periodEndExclusive),items=[];for(const row of rows){const item={...(await ledgerItem(client,principal,row)),source:row.source,quoteId:row.quote_id,feeId:row.fee_id};if(item.outstandingMinor>0)items.push(item);}ensure(items.length>0,409,'STATEMENT_NO_ITEMS','当前账期没有可出账的未结账项');
  const opening=items.filter(item=>item.dueDate<input.periodStart).reduce((sum,item)=>sum+BigInt(item.outstandingMinor),0n),charges=items.filter(item=>item.dueDate>=input.periodStart).reduce((sum,item)=>sum+BigInt(item.originalMinor),0n),adjustment=items.filter(item=>item.dueDate>=input.periodStart).reduce((sum,item)=>sum+BigInt(item.adjustmentMinor??0),0n),closing=items.reduce((sum,item)=>sum+BigInt(item.outstandingMinor),0n),maker=await person(client,principal),dueDate=plusDays(input.periodEndExclusive,rule.issueDelayDays+rule.dueAfterDays),result={id:randomUUID(),version:1,subjectId:rule.subjectId,direction:rule.direction,currency:rule.currency,periodStart:input.periodStart,periodEndExclusive:input.periodEndExclusive,ruleVersionId:input.ruleId,ledgerItems:items.map(item=>({id:item.id,version:item.version})),openingMinor:money(opening),chargesMinor:money(charges),adjustmentMinor:Number(adjustment),allocatedMinor:0,closingMinor:money(closing),dueDate,internalState:'draft',customerState:'unseen',paymentState:'unpaid'};
  try{await client.query('INSERT INTO finance.statement(id,company_id,subject_id,direction,currency,rule_id,period_start,period_end_exclusive,revision,internal_state,customer_state,version,maker_principal_id,maker_person_id,due_date,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,$9,$10,$11,$12,$13,$14,$15)',[result.id,principal.companyId,result.subjectId,result.direction,result.currency,result.ruleVersionId,result.periodStart,result.periodEndExclusive,result.internalState,result.customerState,result.version,principal.principalId,maker,result.dueDate,result]);}catch(error){if(error.code==='23505'){const existing=(await client.query('SELECT * FROM finance.statement WHERE company_id=$1 AND subject_id=$2 AND direction=$3 AND currency=$4 AND rule_id=$5 AND period_start=$6 AND period_end_exclusive=$7 AND revision=1',[principal.companyId,rule.subjectId,rule.direction,rule.currency,input.ruleId,input.periodStart,input.periodEndExclusive])).rows[0];ensure(existing,409,'STATEMENT_CONFLICT','账单正在生成，请重试');return statementView(client,principal,existing);}throw error;}
  for(const item of items)await client.query('INSERT INTO finance.statement_line(company_id,statement_id,ledger_item_id,ledger_item_version,snapshot) VALUES($1,$2,$3,$4,$5)',[principal.companyId,result.id,item.id,item.version,{id:item.id,version:item.version,source:item.source,originalMinor:item.originalMinor,adjustmentMinor:item.adjustmentMinor??0,outstandingMinor:item.outstandingMinor,dueDate:item.dueDate}]);await client.query("INSERT INTO finance.statement_event(company_id,statement_id,version,action,principal_id,person_id,snapshot) VALUES($1,$2,1,'CREATED',$3,$4,$5)",[principal.companyId,result.id,principal.principalId,maker,{recordedAt:new Date().toISOString()}]);return result;
 }
 const row=await statementRow(client,principal,id,true),actor=await person(client,principal);ensure(Number(row.version)===version,412,'VERSION_CONFLICT','账单已变化，请重新查询');const expected={'statement-review':['draft','reviewed','REVIEWED'],'statement-approve':['reviewed','approved','APPROVED'],'statement-issue':['approved','issued','ISSUED']}[kind];ensure(expected&&row.internal_state===expected[0],409,'STATEMENT_INVALID_STATE','当前账单状态不允许此操作');
 const events=(await client.query('SELECT action,person_id FROM finance.statement_event WHERE company_id=$1 AND statement_id=$2 ORDER BY version',[principal.companyId,id])).rows;
 if(kind==='statement-review')ensure(actor!==row.maker_person_id,403,'INDEPENDENT_REVIEW_REQUIRED','账单复核人必须与经办人不同');
 if(kind==='statement-approve')ensure(actor!==row.maker_person_id&&!events.some(event=>event.action==='REVIEWED'&&event.person_id===actor),403,'INDEPENDENT_APPROVAL_REQUIRED','账单审批人必须与经办和复核人不同');
 if(kind==='statement-issue')ensure(events.some(event=>event.action==='APPROVED'&&event.person_id===actor),403,'APPROVER_MUST_ISSUE','仅本账单审批人可签发');
 const next=await statementView(client,principal,{...row,internal_state:expected[1],version:Number(row.version)+1});await client.query('UPDATE finance.statement SET internal_state=$3,version=$4,snapshot=$5,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2',[principal.companyId,id,next.internalState,next.version,next]);await client.query('INSERT INTO finance.statement_event(company_id,statement_id,version,action,principal_id,person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[principal.companyId,id,next.version,expected[2],principal.principalId,actor,{reason:input.reason.trim(),recordedAt:new Date().toISOString()}]);return next;
}

export async function readCustomerStatements(client,principal,id,query){
 const customerId=await currentCustomer(client,principal);
 if(id){const row=await statementRow(client,principal,id);ensure(row.subject_id===customerId&&row.direction==='RECEIVABLE'&&row.internal_state==='issued',404,'NOT_FOUND','资源不存在');return statementView(client,principal,row);}
 const rows=(await client.query("SELECT * FROM finance.statement WHERE company_id=$1 AND subject_id=$2 AND direction='RECEIVABLE' AND internal_state='issued' AND ($3::uuid IS NULL OR id>$3) ORDER BY id LIMIT $4",[principal.companyId,customerId,query.after,query.limit+1])).rows,selected=rows.slice(0,query.limit),items=[];for(const row of selected)items.push(await statementView(client,principal,row));return {items,nextCursor:rows.length>query.limit?query.cursor(selected.at(-1).id):null};
}
export async function readSubjectStatements(client,principal,subjectId,query){
 ensure(uuid.test(subjectId),500,'INVALID_SUBJECT_STATEMENTS','外部账单范围无效');
 const rows=(await client.query("SELECT * FROM finance.statement WHERE company_id=$1 AND subject_id=$2 AND direction='PAYABLE' AND internal_state='issued' AND ($3::uuid IS NULL OR id>$3) ORDER BY id LIMIT $4",[principal.companyId,subjectId,query.after,query.limit+1])).rows,selected=rows.slice(0,query.limit),items=[];
 for(const row of selected)items.push(await statementView(client,principal,row));return {items,nextCursor:rows.length>query.limit?query.cursor(selected.at(-1).id):null};
}
export async function acknowledgeCustomerStatement(client,principal,id,input,version){
 const customerId=await currentCustomer(client,principal),row=await statementRow(client,principal,id,true),actor=await person(client,principal);ensure(row.subject_id===customerId&&row.direction==='RECEIVABLE'&&row.internal_state==='issued',404,'NOT_FOUND','资源不存在');ensure(Number(row.version)===version,412,'VERSION_CONFLICT','账单已变化，请重新查询');ensure((row.customer_state??'unseen')==='unseen',409,'STATEMENT_ALREADY_ACKNOWLEDGED','账单已被确认或进入争议处理');
 const next=await statementView(client,principal,{...row,customer_state:'acknowledged',version:Number(row.version)+1});await client.query('UPDATE finance.statement SET customer_state=$3,version=$4,snapshot=$5,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2',[principal.companyId,id,next.customerState,next.version,next]);await client.query('INSERT INTO finance.statement_event(company_id,statement_id,version,action,principal_id,person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[principal.companyId,id,next.version,'ACKNOWLEDGED',principal.principalId,actor,{reason:input.reason.trim(),recordedAt:new Date().toISOString()}]);return next;
}

export async function refundReserved(client,principal,source,id){
 ensure(['generic','prepayment'].includes(source)&&uuid.test(id),500,'INVALID_REFUND_SOURCE','退款来源无效');
 const column=source==='generic'?'generic_receipt_id':'prepayment_receipt_id';
 const row=(await client.query(`SELECT COALESCE(sum(money_amount_minor),0) AS total FROM finance.refund_request WHERE company_id=$1 AND ${column}=$2`,[principal.companyId,id])).rows[0];
 return money(BigInt(row.total));
}
async function customerSettlementAccount(client,principal,customerId,id){
 ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');
 const row=(await client.query('SELECT * FROM finance.settlement_account WHERE company_id=$1 AND id=$2 AND subject_id=$3 AND version=(SELECT max(current_account.version) FROM finance.settlement_account current_account WHERE current_account.company_id=finance.settlement_account.company_id AND current_account.subject_id=finance.settlement_account.subject_id) FOR KEY SHARE',[principal.companyId,id,customerId])).rows[0];
 ensure(row&&row.state==='verified',404,'NOT_FOUND','资源不存在');return row;
}
async function refundSource(client,principal,customerId,id){
 ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');
 const generic=(await client.query('SELECT r.id,r.payer_subject_id,r.money_amount_minor,r.money_currency,r.snapshot,rc.snapshot AS confirmation FROM finance.receipt r LEFT JOIN finance.receipt_confirmation rc ON (rc.company_id,rc.receipt_id)=(r.company_id,r.id) WHERE r.company_id=$1 AND r.id=$2 FOR UPDATE OF r',[principal.companyId,id])).rows[0];
 if(generic){
  ensure(generic.payer_subject_id===customerId,404,'NOT_FOUND','资源不存在');ensure(generic.confirmation,409,'RECEIPT_NOT_CONFIRMED','仅已确认收款可申请退款');
  return {source:'generic',id,money:{amountMinor:Number(generic.money_amount_minor),currency:generic.money_currency},version:2,allocatedMinor:0};
 }
 const prepayment=(await client.query('SELECT r.id,r.money_amount_minor,r.currency,r.snapshot,d.customer_id,rd.snapshot AS decision FROM finance.prepayment_receipt r JOIN orders.draft d ON (d.company_id,d.id)=(r.company_id,r.order_id) LEFT JOIN finance.receipt_decision rd ON (rd.company_id,rd.receipt_id)=(r.company_id,r.id) WHERE r.company_id=$1 AND r.id=$2 FOR UPDATE OF r',[principal.companyId,id])).rows[0];
 ensure(prepayment&&prepayment.customer_id===customerId,404,'NOT_FOUND','资源不存在');ensure(prepayment.decision?.approve===true,409,'RECEIPT_NOT_CONFIRMED','仅已确认收款可申请退款');
 const allocated=BigInt((await client.query("SELECT COALESCE(sum((a.snapshot->>'amountMinor')::bigint),0) AS total FROM finance.prepayment_allocation a JOIN finance.allocation_event e ON (a.company_id,a.id)=(e.company_id,e.allocation_id) WHERE a.company_id=$1 AND a.receipt_id=$2 AND e.action='POSTED' AND NOT EXISTS(SELECT 1 FROM finance.reversal_event r WHERE r.company_id=a.company_id AND r.allocation_id=a.id AND r.action='POSTED')",[principal.companyId,id])).rows[0].total);
 return {source:'prepayment',id,money:{amountMinor:Number(prepayment.money_amount_minor),currency:prepayment.currency},version:2,allocatedMinor:money(allocated)};
}
export async function readCustomerSettlementAccounts(client,principal,query){
 const customerId=await currentCustomer(client,principal);
 const rows=(await client.query("SELECT * FROM finance.settlement_account WHERE company_id=$1 AND subject_id=$2 AND state='verified' AND version=(SELECT max(current_account.version) FROM finance.settlement_account current_account WHERE current_account.company_id=finance.settlement_account.company_id AND current_account.subject_id=finance.settlement_account.subject_id) AND ($3::uuid IS NULL OR id>$3) ORDER BY id LIMIT $4",[principal.companyId,customerId,query.after,query.limit+1])).rows,selected=rows.slice(0,query.limit);
 return {items:selected.map(accountView),nextCursor:rows.length>query.limit?query.cursor(selected.at(-1).id):null};
}
export async function readDriverSettlementAccounts(client,principal,query){
 await driverIdentity(client,principal);
 const rows=(await client.query("SELECT * FROM finance.settlement_account WHERE company_id=$1 AND subject_id=$2 AND state='verified' AND version=(SELECT max(current_account.version) FROM finance.settlement_account current_account WHERE current_account.company_id=finance.settlement_account.company_id AND current_account.subject_id=finance.settlement_account.subject_id) AND ($3::uuid IS NULL OR id>$3) ORDER BY id LIMIT $4",[principal.companyId,principal.principalId,query.after,query.limit+1])).rows,selected=rows.slice(0,query.limit);
 return {items:selected.map(accountView),nextCursor:rows.length>query.limit?query.cursor(selected.at(-1).id):null};
}
export async function readDriverWithdrawals(client,principal,query){
 await driverIdentity(client,principal);
 const rows=(await client.query('SELECT * FROM finance.driver_withdrawal_request WHERE company_id=$1 AND driver_id=$2 AND ($3::uuid IS NULL OR id>$3) ORDER BY id LIMIT $4',[principal.companyId,principal.principalId,query.after,query.limit+1])).rows,selected=rows.slice(0,query.limit);
 return {items:selected.map(driverWithdrawalView),nextCursor:rows.length>query.limit?query.cursor(selected.at(-1).id):null};
}
export async function requestDriverWithdrawal(client,principal,input){
 await driverIdentity(client,principal);
 ensure(input.kind==='PAYMENT'&&uuid.test(input.ledgerItemId)&&uuid.test(input.accountId),422,'INVALID_WITHDRAWAL_REQUEST','提现申请无效');
 ensure(Number.isSafeInteger(input.ledgerItemVersion)&&input.ledgerItemVersion===1&&Number.isSafeInteger(input.accountVersion)&&input.accountVersion>=1&&input.reason.trim(),422,'INVALID_WITHDRAWAL_REQUEST','提现版本或原因无效');
 ensure(input.money&&Number.isSafeInteger(input.money.amountMinor)&&input.money.amountMinor>=1&&input.money.amountMinor<=Number(MAX)&&['USD','KHR'].includes(input.money.currency),422,'INVALID_WITHDRAWAL_REQUEST','提现金额或币种无效');
 const source=(await client.query('SELECT id,snapshot FROM finance.ledger_item WHERE company_id=$1 AND id=$2 FOR UPDATE',[principal.companyId,input.ledgerItemId])).rows[0];
 ensure(source&&source.snapshot.subjectId===principal.principalId&&source.snapshot.purpose==='DRIVER_INCOME'&&source.snapshot.direction==='PAYABLE',404,'NOT_FOUND','资源不存在');
 const account=await customerSettlementAccount(client,principal,principal.principalId,input.accountId);
 ensure(Number(account.version)===input.accountVersion,412,'ACCOUNT_VERSION_CONFLICT','结算账户已变化，请重新查询');ensure(source.snapshot.currency===input.money.currency,422,'CURRENCY_MISMATCH','提现币种必须与收入一致');
 const reserved=BigInt((await client.query("SELECT COALESCE(sum(money_amount_minor),0) AS total FROM finance.driver_withdrawal_request WHERE company_id=$1 AND driver_id=$2 AND ledger_item_id=$3 AND state='submitted'",[principal.companyId,principal.principalId,source.id])).rows[0].total),available=BigInt(source.snapshot.outstandingMinor??source.snapshot.originalMinor)-reserved;
 ensure(available>=BigInt(input.money.amountMinor),422,'WITHDRAWAL_AMOUNT_EXCEEDS_AVAILABLE','提现金额超过可提现收入');
 const actor=await person(client,principal),now=new Date().toISOString(),result={id:randomUUID(),version:1,kind:'PAYMENT',state:'submitted',money:input.money,sourceIds:[source.id],nextAction:'提现申请已提交，等待独立复核和审批。',updatedAt:now};
 const snapshot={...result,ledgerItemId:source.id,ledgerItemVersion:1,accountId:account.id,accountVersion:Number(account.version),reason:input.reason.trim(),driverId:principal.principalId,preparedBy:principal.principalId,personId:actor,createdAt:now};
 await client.query('INSERT INTO finance.driver_withdrawal_request(id,company_id,driver_id,ledger_item_id,settlement_account_id,money_amount_minor,money_currency,ledger_item_version,account_version,version,state,reason,prepared_by,person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,1,$8,1,$9,$10,$11,$12,$13)',[result.id,principal.companyId,principal.principalId,source.id,account.id,input.money.amountMinor,input.money.currency,input.accountVersion,result.state,input.reason.trim(),principal.principalId,actor,snapshot]);
 return result;
}
export async function readOpsSettlementAccounts(client,principal,query){
 const scoped=(await client.query("SELECT 1 FROM org.role_grant WHERE company_id=$1 AND principal_id=$2 AND state='active' AND expires_at>clock_timestamp() AND subject_ids @> ARRAY[$3]::uuid[]",[principal.companyId,principal.principalId,query.subjectId])).rowCount;
 ensure(scoped,404,'NOT_FOUND','资源不存在');
 const rows=(await client.query("SELECT * FROM finance.settlement_account WHERE company_id=$1 AND subject_id=$2 AND state='verified' AND version=(SELECT max(current_account.version) FROM finance.settlement_account current_account WHERE current_account.company_id=finance.settlement_account.company_id AND current_account.subject_id=finance.settlement_account.subject_id) AND ($3::uuid IS NULL OR id>$3) ORDER BY id LIMIT $4",[principal.companyId,query.subjectId,query.after,query.limit+1])).rows,selected=rows.slice(0,query.limit);
 return {items:selected.map(accountView),nextCursor:rows.length>query.limit?query.cursor(selected.at(-1).id):null};
}
export async function readCustomerFinanceRequests(client,principal,query){
 const customerId=await currentCustomer(client,principal);
 const rows=(await client.query('SELECT * FROM finance.refund_request WHERE company_id=$1 AND customer_id=$2 AND ($3::uuid IS NULL OR id>$3) ORDER BY id LIMIT $4',[principal.companyId,customerId,query.after,query.limit+1])).rows,selected=rows.slice(0,query.limit);
 return {items:selected.map(financeRequestView),nextCursor:rows.length>query.limit?query.cursor(selected.at(-1).id):null};
}
export async function requestCustomerRefund(client,principal,input){
 const customerId=await currentCustomer(client,principal);
 ensure(input.kind==='REFUND'&&uuid.test(input.receiptId)&&uuid.test(input.accountId),422,'INVALID_REFUND_REQUEST','退款申请无效');
 ensure(Number.isSafeInteger(input.receiptVersion)&&input.receiptVersion>=1&&Number.isSafeInteger(input.accountVersion)&&input.accountVersion>=1&&input.reason.trim(),422,'INVALID_REFUND_REQUEST','退款版本或原因无效');
 ensure(input.money&&Number.isSafeInteger(input.money.amountMinor)&&input.money.amountMinor>=1&&input.money.amountMinor<=Number(MAX)&&['USD','KHR'].includes(input.money.currency),422,'INVALID_REFUND_REQUEST','退款金额或币种无效');
 const source=await refundSource(client,principal,customerId,input.receiptId),account=await customerSettlementAccount(client,principal,customerId,input.accountId);
 ensure(source.version===input.receiptVersion,412,'RECEIPT_VERSION_CONFLICT','收款记录已变化，请重新查询');ensure(Number(account.version)===input.accountVersion,412,'ACCOUNT_VERSION_CONFLICT','结算账户已变化，请重新查询');ensure(source.money.currency===input.money.currency,422,'CURRENCY_MISMATCH','退款币种必须与原收款一致');
 const reserved=BigInt(await refundReserved(client,principal,source.source,source.id)),available=BigInt(source.money.amountMinor)-BigInt(source.allocatedMinor)-reserved;
 ensure(available>=BigInt(input.money.amountMinor),422,'REFUND_AMOUNT_EXCEEDS_AVAILABLE','退款金额超过可退款余额');
 const actor=await person(client,principal),now=new Date().toISOString(),result={id:randomUUID(),version:1,kind:'REFUND',state:'submitted',money:input.money,sourceIds:[source.id],nextAction:'退款申请已提交，等待独立复核。',updatedAt:now};
 const snapshot={...result,receiptId:source.id,receiptVersion:source.version,accountId:account.id,accountVersion:Number(account.version),reason:input.reason.trim(),customerId,preparedBy:principal.principalId,personId:actor,createdAt:now};
 await client.query('INSERT INTO finance.refund_request(id,company_id,customer_id,generic_receipt_id,prepayment_receipt_id,settlement_account_id,money_amount_minor,money_currency,version,state,reason,prepared_by,person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,$9,$10,$11,$12,$13)',[result.id,principal.companyId,customerId,source.source==='generic'?source.id:null,source.source==='prepayment'?source.id:null,account.id,input.money.amountMinor,input.money.currency,result.state,input.reason.trim(),principal.principalId,actor,snapshot]);
 return result;
}
