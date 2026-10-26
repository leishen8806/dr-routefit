import {createHash,randomUUID} from 'node:crypto';
import {ensure} from '../domain/errors.mjs';
import {sealAccountChange} from './account-change.mjs';

const canonical=value=>JSON.stringify(value,(_,current)=>current&&typeof current==='object'&&!Array.isArray(current)?Object.fromEntries(Object.keys(current).sort().map(key=>[key,current[key]])):current);
const hash=value=>createHash('sha256').update(canonical(value)).digest('hex');
const sourceIds=input=>[input.ledgerItemId,input.receiptId,input.orderId,...(input.receiptIds??[])].filter(Boolean);
const person=async(client,principal)=>{
 const row=(await client.query('SELECT person_id FROM org.principal WHERE company_id=$1 AND id=$2',[principal.companyId,principal.principalId])).rows[0];
 ensure(row?.person_id,403,'FINANCE_OPERATOR_REQUIRED','当前人员无效');
 return row.person_id;
};

const state={REVISED:'draft',SUBMITTED:'submitted',REVIEWED:'reviewed',APPROVED:'approved',REJECTED:'rejected',EXECUTION_RECORDED:'processing',RESULT_CONFIRMED:'confirmed',RESULT_FAILED:'failed',RESULT_UNKNOWN:'unknown',POSTED:'posted'};
const role={REVISED:'MAKER',SUBMITTED:'MAKER',REVIEWED:'REVIEWER',APPROVED:'APPROVER',REJECTED:'REVIEWER',EXECUTION_RECORDED:'EXECUTOR',RESULT_CONFIRMED:'CHECKER',RESULT_FAILED:'CHECKER',RESULT_UNKNOWN:'CHECKER',POSTED:'APPROVER'};

export const workflowTransitionAllowed=(currentState,kind,action)=>{
 const expected={REVISED:['draft','rejected'],SUBMITTED:['draft'],REVIEWED:['submitted'],APPROVED:['reviewed'],REJECTED:['submitted','reviewed'],EXECUTION_RECORDED:['approved'],RESULT_CONFIRMED:['processing'],RESULT_FAILED:['processing'],RESULT_UNKNOWN:['processing'],POSTED:['CHANNEL_SETTLEMENT','ACCOUNT_CHANGE'].includes(kind)?['approved']:['confirmed']}[action];
 return Boolean(expected?.includes(currentState))&&!(['CHANNEL_SETTLEMENT','ACCOUNT_CHANGE'].includes(kind)&&['EXECUTION_RECORDED','RESULT_CONFIRMED','RESULT_FAILED','RESULT_UNKNOWN'].includes(action));
};

async function postAccountChange(client,principal,details){
 ensure(Number.isSafeInteger(details.currentAccountVersion)&&details.currentAccountVersion>=0,422,'ACCOUNT_VERSION_INVALID','结算账户版本无效');
 await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${principal.companyId}:${details.subjectId}`]);
 const latest=(await client.query('SELECT version FROM finance.settlement_account WHERE company_id=$1 AND subject_id=$2 ORDER BY version DESC LIMIT 1 FOR UPDATE',[principal.companyId,details.subjectId])).rows[0],currentVersion=Number(latest?.version??0);
 ensure(currentVersion===details.currentAccountVersion,412,'ACCOUNT_VERSION_CONFLICT','结算账户已变化，请重新查询');
 const account={id:randomUUID(),version:currentVersion+1,subjectId:details.subjectId,bankCode:details.bankCode,last4:details.last4,holderDisplayName:details.holderDisplayName,state:'verified'};
 await client.query('INSERT INTO finance.settlement_account(id,company_id,subject_id,version,bank_code,last4,holder_display_name,state,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[account.id,principal.companyId,account.subjectId,account.version,account.bankCode,account.last4,account.holderDisplayName,account.state,account]);
 return account;
}
export const resultReferenceMatches=(history,externalReference)=>history.toReversed().find(entry=>entry.role==='EXECUTOR')?.comment===externalReference;

export const replayWorkflow=(row,events)=>{
 let details=row.snapshot.details,contentHash=hash(details);
 const history=[{personId:row.maker_person_id,role:'MAKER',documentVersion:1,contentHash,at:row.created_at.toISOString(),comment:row.snapshot.reason}];
 for(const event of events){
  if(event.action==='REVISED'){details=event.snapshot.details;contentHash=hash(details);}
  history.push({personId:event.person_id,role:role[event.action],documentVersion:Number(event.version),contentHash,at:event.created_at.toISOString(),comment:event.snapshot.reason??event.snapshot.externalReference??'workflow action'});
 }
 return {details,contentHash,history,state:state[events.at(-1)?.action]??'draft'};
};

export async function workflowDocument(client,principal,id){
 const row=(await client.query('SELECT * FROM finance.workflow_document WHERE company_id=$1 AND id=$2',[principal.companyId,id])).rows[0];
 ensure(row,404,'NOT_FOUND','资源不存在');
 const events=(await client.query('SELECT * FROM finance.workflow_document_event WHERE company_id=$1 AND document_id=$2 ORDER BY version',[principal.companyId,id])).rows;
 const replay=replayWorkflow(row,events),details=replay.details;
 return {id:row.id,version:Number(events.at(-1)?.version??1),kind:row.kind,state:replay.state,money:details.money??{amountMinor:Number(row.money_amount_minor),currency:row.money_currency},subjectId:details.subjectId??details.beneficiarySubjectId??row.subject_id,makerPersonId:row.maker_person_id,contentHash:replay.contentHash,sourceIds:sourceIds(details),accountSnapshot:null,history:replay.history,reason:details.reason,details};
}

export async function createWorkflowDocument(client,principal,input){
 ensure(['PAYMENT','REFUND','PAYABLE','ACCOUNT_CHANGE','CHANNEL_SETTLEMENT'].includes(input.kind),422,'UNSUPPORTED_DOCUMENT_KIND','当前单据类型不支持');
 const accountChange=input.kind==='ACCOUNT_CHANGE'?sealAccountChange(input):null,details=accountChange?.details??input,who=await person(client,principal),money=input.money??{amountMinor:input.netMinor,currency:input.currency};
 const effectiveMoney=accountChange?{amountMinor:0,currency:input.currency}:money;
 ensure(effectiveMoney&&Number.isSafeInteger(effectiveMoney.amountMinor)&&effectiveMoney.amountMinor>=0&&(accountChange||effectiveMoney.amountMinor>0)&&['USD','KHR'].includes(effectiveMoney.currency),422,'INVALID_DOCUMENT_MONEY','金额或币种无效');
 const id=randomUUID(),subjectId=input.subjectId??input.beneficiarySubjectId??principal.companyId,snapshot={details,reason:details.reason,sourceIds:sourceIds(details),accountSnapshot:null};
 await client.query('INSERT INTO finance.workflow_document(id,company_id,kind,maker_principal_id,maker_person_id,subject_id,money_amount_minor,money_currency,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,principal.companyId,input.kind,principal.principalId,who,subjectId,effectiveMoney.amountMinor,effectiveMoney.currency,snapshot]);
 if(accountChange)await client.query('INSERT INTO finance.workflow_account_change_secret(company_id,document_id,document_version,key_id,iv,ciphertext,tag) VALUES($1,$2,1,$3,$4,$5,$6)',[principal.companyId,id,accountChange.sealed.keyId,accountChange.sealed.iv,accountChange.sealed.ciphertext,accountChange.sealed.tag]);
 return workflowDocument(client,principal,id);
}

export async function readWorkflowDocuments(client,principal,query){
 const rows=(await client.query('SELECT id FROM finance.workflow_document WHERE company_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3',[principal.companyId,query.after,query.limit+1])).rows,items=[];
 for(const row of rows.slice(0,query.limit))items.push(await workflowDocument(client,principal,row.id));
 return {items,nextCursor:rows.length>query.limit?query.cursor(rows.at(query.limit-1).id):null};
}

export async function writeWorkflowDocument(client,principal,kind,id,input,version){
 const current=await workflowDocument(client,principal,id);
 ensure(current.version===version,412,'VERSION_CONFLICT','财务单据已变化');
 const who=await person(client,principal),action={submit:'SUBMITTED',review:'REVIEWED',approve:'APPROVED',reject:'REJECTED',execution:'EXECUTION_RECORDED',result:input.result==='CONFIRMED'?'RESULT_CONFIRMED':input.result==='FAILED'?'RESULT_FAILED':'RESULT_UNKNOWN',post:'POSTED',revise:'REVISED'}[kind];
 ensure(action,500,'INVALID_WORKFLOW_ACTION','单据动作无效');
 ensure(workflowTransitionAllowed(current.state,current.kind,action),409,'INVALID_STATE','当前单据状态不允许该动作');
 if(action==='REVISED')ensure(input.kind===current.kind,422,'DOCUMENT_KIND_IMMUTABLE','修订不得改变单据类型');
 if(['SUBMITTED','REVISED'].includes(action))ensure(who===current.makerPersonId,403,'MAKER_REQUIRED','仅经办人可修改或提交');
 if(['REVIEWED','REJECTED'].includes(action))ensure(who!==current.makerPersonId,403,'INDEPENDENT_REVIEW_REQUIRED','复核人必须独立');
 if(action==='APPROVED')ensure(!current.history.some(entry=>['MAKER','REVIEWER'].includes(entry.role)&&entry.personId===who),403,'INDEPENDENT_APPROVAL_REQUIRED','审批人必须独立');
 if(action.startsWith('RESULT_')){ensure(!current.history.some(entry=>entry.role==='EXECUTOR'&&entry.personId===who),403,'INDEPENDENT_CHECK_REQUIRED','核对人不得是执行人');ensure(resultReferenceMatches(current.history,input.externalReference),422,'EXECUTION_REFERENCE_MISMATCH','核对结果必须对应已登记的付款指令');}
 const accountChange=action==='REVISED'&&current.kind==='ACCOUNT_CHANGE'?sealAccountChange(input):null,account=action==='POSTED'&&current.kind==='ACCOUNT_CHANGE'?await postAccountChange(client,principal,current.details):null,snapshot=action==='REVISED'?{details:accountChange?.details??input,reason:input.reason}:account?{reason:input.reason,account}:input;
 await client.query('INSERT INTO finance.workflow_document_event(company_id,document_id,version,action,principal_id,person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[principal.companyId,id,version+1,action,principal.principalId,who,snapshot]);
 if(accountChange)await client.query('INSERT INTO finance.workflow_account_change_secret(company_id,document_id,document_version,key_id,iv,ciphertext,tag) VALUES($1,$2,$3,$4,$5,$6,$7)',[principal.companyId,id,version+1,accountChange.sealed.keyId,accountChange.sealed.iv,accountChange.sealed.ciphertext,accountChange.sealed.tag]);
 return workflowDocument(client,principal,id);
}
