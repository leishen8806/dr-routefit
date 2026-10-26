const module=(value,observedAt)=>({mode:'live',quality:'fresh',value:Number(value),observedAt,unknownReason:null});
export async function readOpsSnapshot(client,principal){
 const row=(await client.query("SELECT clock_timestamp() AS observed_at,(SELECT count(*) FROM orders.draft WHERE company_id=$1) AS orders,(SELECT count(*) FROM fleet.vehicle WHERE company_id=$1) AS vehicles,(SELECT count(*) FROM casework.dispatch_exception WHERE company_id=$1 AND state<>'closed') AS exceptions",[principal.companyId])).rows[0],observedAt=row.observed_at.toISOString();
 return {schemaVersion:'1.0.0',generatedAt:observedAt,orders:module(row.orders,observedAt),vehicles:module(row.vehicles,observedAt),exceptions:module(row.exceptions,observedAt),inventory:{mode:'unavailable',quality:'unavailable',value:null,observedAt:null,unknownReason:'WAREHOUSE_INVENTORY_NOT_INTEGRATED'}};
}
