import {createHash} from 'node:crypto';
import {ensure} from '../domain/errors.mjs';

export async function readPublicTracking(pool,ref){
 const tokenHash=createHash('sha256').update(ref).digest('hex'),row=(await pool.query('SELECT * FROM sharing.public_tracking($1)',[tokenHash])).rows[0];
 ensure(row,404,'NOT_FOUND','资源不存在');return {orderLabel:row.order_label,state:row.state,promiseWindow:row.promise_window,etaAt:row.eta_at?.toISOString()??null,etaType:row.eta_type,updatedAt:row.updated_at.toISOString(),quality:row.quality,contactEntry:row.contact_entry};
}
