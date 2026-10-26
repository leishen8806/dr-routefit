import {randomUUID} from 'node:crypto';
import {ensure} from '../domain/errors.mjs';

const view=row=>({id:row.id,version:1,accountId:row.account_id,externalTransactionId:row.external_transaction_id,direction:row.direction,money:{amountMinor:Number(row.amount_minor),currency:row.currency},matchedMinor:0,unmatchedMinor:Number(row.amount_minor),bookedAt:row.booked_at.toISOString()});
async function evidence(client,principal,ids){
 ensure(new Set(ids).size===ids.length,422,'DUPLICATE_EVIDENCE','证据不得重复');const found=Number((await client.query("SELECT count(*) AS count FROM evidence.file WHERE company_id=$1 AND id=ANY($2::uuid[]) AND state='available'",[principal.companyId,ids])).rows[0].count);ensure(found===ids.length,422,'EVIDENCE_UNAVAILABLE','证据不存在或未完成');
}
export async function readBankTransactions(client,principal,query){
 const rows=(await client.query('SELECT * FROM finance.bank_transaction WHERE company_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3',[principal.companyId,query.after,query.limit+1])).rows,items=rows.slice(0,query.limit).map(view);
 return {items,nextCursor:rows.length>query.limit?query.cursor(items.at(-1).id):null};
}
export async function writeBankTransaction(client,principal,input){
 ensure(Date.parse(input.bookedAt)<=Date.now(),422,'INVALID_BOOKED_AT','入账时间不能在未来');await evidence(client,principal,input.evidenceFileIds);
 const account=(await client.query('SELECT id,currency FROM finance.receiving_account WHERE company_id=$1 AND id=$2 AND active',[principal.companyId,input.accountId])).rows[0];ensure(account,404,'NOT_FOUND','收款账户不存在或未启用');ensure(account.currency===input.money.currency,422,'CURRENCY_MISMATCH','流水币种与账户不一致');
 const result={id:randomUUID(),accountId:input.accountId,externalTransactionId:input.externalTransactionId.trim().toUpperCase(),direction:input.direction,money:input.money,bookedAt:input.bookedAt};
 try{await client.query('INSERT INTO finance.bank_transaction(id,company_id,account_id,external_transaction_id,direction,amount_minor,currency,booked_at,snapshot,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[result.id,principal.companyId,result.accountId,result.externalTransactionId,result.direction,result.money.amountMinor,result.money.currency,result.bookedAt,{...result,version:1,matchedMinor:0,unmatchedMinor:result.money.amountMinor,evidenceFileIds:input.evidenceFileIds,recordedAt:new Date().toISOString()},principal.principalId]);}catch(error){if(error.code==='23505')ensure(false,409,'BANK_TRANSACTION_DUPLICATE','同一账户银行流水已登记');throw error;}
 for(const evidenceId of input.evidenceFileIds)await client.query('INSERT INTO finance.bank_transaction_evidence(company_id,transaction_id,evidence_file_id) VALUES($1,$2,$3)',[principal.companyId,result.id,evidenceId]);
 return {...result,version:1,matchedMinor:0,unmatchedMinor:result.money.amountMinor};
}
