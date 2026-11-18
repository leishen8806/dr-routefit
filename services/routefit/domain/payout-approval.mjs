import {ensure} from './errors.mjs';

export function approvePayout(payout,actorId){
 ensure(payout.state==='submitted',409,'INVALID_PAYOUT_STATE','出款申请当前不能审批');
 ensure(actorId!==payout.requestedBy,403,'SELF_APPROVAL_FORBIDDEN','申请人不能审批自己的出款');
 return {...payout,state:'approved',version:payout.version+1,approvedBy:actorId};
}

export function confirmPayoutPaid(payout,actorId){
 ensure(payout.state==='approved',409,'INVALID_PAYOUT_STATE','出款申请尚未审批');
 ensure(actorId!==payout.approvedBy,403,'SELF_CONFIRM_FORBIDDEN','审批人不能确认自己的出款');
 return {...payout,state:'paid',version:payout.version+1,confirmedBy:actorId,paymentMode:'simulated'};
}
