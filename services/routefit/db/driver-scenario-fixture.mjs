import {randomUUID} from 'node:crypto';
import pg from 'pg';

function localDatabaseUrl(value){
 const url=new URL(value);
 if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw Error('Driver scenario fixture database must be local');
 return url.href;
}

export async function createDriverRouteFixture({connectionString,companyId,driverId,orderId,createdBy}){
 const pool=new pg.Pool({connectionString:localDatabaseUrl(connectionString),max:1}),client=await pool.connect();
 try{
  await client.query('BEGIN');
  const vehicleId=randomUUID(),specVersionId=randomUUID(),planId=randomUUID(),planVersionId=randomUUID(),validUntil=new Date(Date.now()+3600000).toISOString();
  await client.query("INSERT INTO fleet.vehicle(id,company_id,driver_id,spec_version_id,label,kind,state,max_payload_kg,internal_length_cm,internal_width_cm,internal_height_cm,door_width_cm,door_height_cm) VALUES($1,$2,$3,$4,'DEMO driver scenario van','VAN','available',500,300,180,180,160,160)",[vehicleId,companyId,driverId,specVersionId]);
  await client.query("INSERT INTO dispatch.route_plan(id,company_id,vehicle_id,driver_id,current_version,state,snapshot,created_by) VALUES($1,$2,$3,$4,1,'ready',$5,$6)",[planId,companyId,vehicleId,driverId,{id:planId,vehicleId,driverId,currentVersion:1,state:'ready'},createdBy]);
  await client.query("INSERT INTO dispatch.route_plan_version(id,company_id,plan_id,plan_version,state,snapshot,created_by) VALUES($1,$2,$3,1,'ready',$4,$5)",[planVersionId,companyId,planId,{id:planVersionId,planId,planVersion:1,state:'ready',estimateType:'MANUAL',validUntil},createdBy]);
  for(const [sequence,stopType] of ['PICKUP','DROPOFF'].entries()){const id=randomUUID();await client.query('INSERT INTO dispatch.route_stop(id,company_id,plan_version_id,order_id,sequence_no,stop_type,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,companyId,planVersionId,orderId,sequence+1,stopType,{id,stopType}]);}
  await client.query('COMMIT');return {vehicleId,specVersionId,planId,planVersion:1};
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();await pool.end();}
}
