import {randomUUID} from 'node:crypto';
import {ensure} from '../domain/errors.mjs';
import {validatePolicy,assertIndependent} from '../domain/policy.mjs';
import {getTariff} from './postgres.mjs';

export async function getPolicy(client,principal,id){
 const company=principal.companyId;
 const row=(await client.query('SELECT * FROM pricing.policy_version WHERE company_id=$1 AND id=$2',[company,id])).rows[0];
 ensure(row,404,'NOT_FOUND','资源不存在');
 const review=(await client.query('SELECT reviewed_by,reason,created_at FROM pricing.policy_review WHERE company_id=$1 AND policy_id=$2',[company,id])).rows[0];
 const publication=(await client.query('SELECT approved_by,reason,created_at FROM pricing.policy_publication WHERE company_id=$1 AND policy_id=$2',[company,id])).rows[0];
 return {...row.snapshot,version:publication?3:review?2:1,state:publication?'PUBLISHED':review?'REVIEWED':'SUBMITTED',
  review:review?{principalId:review.reviewed_by,reason:review.reason,createdAt:review.created_at.toISOString()}:null,
  publication:publication?{principalId:publication.approved_by,reason:publication.reason,createdAt:publication.created_at.toISOString()}:null};
}
export async function listPublishedPolicies(client,principal,query){
 const values=[principal.companyId],where=['pv.company_id=$1','pub.policy_id IS NOT NULL'];
 const add=(sql,value)=>{values.push(value);where.push(sql.replace('$N','$'+values.length));};
 if(query.tariffId)add('pv.tariff_id=$N',query.tariffId);
 if(query.serviceLevel)add("(pv.snapshot->'serviceLevels') ? $N",query.serviceLevel);
 add("(pv.snapshot->>'validFrom')::timestamptz <= $N::timestamptz",query.effectiveAt);
 add("(pv.snapshot->>'validUntil')::timestamptz > $N::timestamptz",query.effectiveAt);
 if(query.after)add('pv.id>$N',query.after);
 const limit=Number(query.limit)+1;
 const sql=`SELECT pv.id,pv.tariff_id,pv.tariff_version,pv.snapshot,pub.created_at AS published_at
   FROM pricing.policy_version pv LEFT JOIN pricing.policy_publication pub ON pub.company_id=pv.company_id AND pub.policy_id=pv.id
   WHERE ${where.join(' AND ')} ORDER BY pv.id LIMIT $${values.length+1}`;
 values.push(limit);
 const rows=(await client.query(sql,values)).rows;
 const items=rows.slice(0,query.limit).map(r=>({
  id:r.id, state:'PUBLISHED', version:3, tariffId:r.tariff_id, tariffVersion:Number(r.tariff_version),
  validFrom:r.snapshot.validFrom, validUntil:r.snapshot.validUntil, serviceLevels:r.snapshot.serviceLevels,
  publishedAt:r.published_at.toISOString()
 }));
 return {items,nextAfter:rows.length>query.limit?items.at(-1).id:null};
}
export async function submitPolicy(client,principal,tariffId,input,version){
 const tariff=await getTariff(client,principal.companyId,tariffId,true);
 ensure(tariff.version===version,412,'VERSION_CONFLICT','费率草稿已变化，请重新读取');validatePolicy(tariff,input);
 const contributors=(await client.query('SELECT DISTINCT principal_id FROM pricing.tariff_revision WHERE company_id=$1 AND tariff_id=$2 AND version<=$3',[principal.companyId,tariffId,version])).rows.map(r=>r.principal_id);
 if(!contributors.includes(principal.principalId))contributors.push(principal.principalId);
 const id=randomUUID(),snapshot={id,tariffId,tariffVersion:version,preparedBy:principal.principalId,contributors,tariff,...input,createdAt:new Date().toISOString()};
 await client.query('INSERT INTO pricing.policy_version(id,company_id,tariff_id,tariff_version,prepared_by,contributors,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,principal.companyId,tariffId,version,principal.principalId,contributors,snapshot]);
 return getPolicy(client,principal,id);
}
export async function reviewOrPublishPolicy(client,principal,id,input,version,publish){
 // Serialize different idempotency keys without granting UPDATE on immutable evidence tables.
 await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['policy:'+principal.companyId+':'+id]);
 const policy=await getPolicy(client,principal,id);
 ensure(policy.version===version,412,'VERSION_CONFLICT','策略审核版本已变化');
 ensure(policy.state===(publish?'REVIEWED':'SUBMITTED'),409,'INVALID_STATE',publish?'须先独立复核':'只能复核未审核的策略');
 ensure(input.reason.trim(),422,'REASON_REQUIRED','审核依据不能为空');
 assertIndependent(policy.contributors,principal.principalId,publish?policy.review.principalId:null);
 const tariff=await getTariff(client,principal.companyId,policy.tariffId,true);
 ensure(tariff.version===policy.tariffVersion,409,'SOURCE_VERSION_CHANGED','费率草稿已经修改，须提交新策略重新审核');
 validatePolicy(tariff,policy);
 if(publish)await client.query('INSERT INTO pricing.policy_publication(company_id,policy_id,prepared_by,reviewed_by,approved_by,reason) VALUES($1,$2,$3,$4,$5,$6)',[principal.companyId,id,policy.preparedBy,policy.review.principalId,principal.principalId,input.reason]);
 else await client.query('INSERT INTO pricing.policy_review(company_id,policy_id,prepared_by,reviewed_by,reason) VALUES($1,$2,$3,$4,$5)',[principal.companyId,id,policy.preparedBy,principal.principalId,input.reason]);
 return getPolicy(client,principal,id);
}
