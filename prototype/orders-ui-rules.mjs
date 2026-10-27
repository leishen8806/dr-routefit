export const selectableServiceLevels=Object.freeze({S2:'当日送',S3:'预约送'});
export function intakeFieldForPath(path){const item=path?.match(/^\/items\/(\d+)/);if(path==='/evidence')return 'intake.pickup.reference';if(path==='/pickup/point')return 'pickup.lng';if(path==='/delivery/point')return 'delivery.lng';if(path==='/requestedDeliveryWindow')return 'requestedDeliveryWindow.end';return item?`items.${item[1]}.unknownReason`:null;}
export function retainedPoint(prior,address,landmark,point){return prior&&(address!==prior.address||landmark!==(prior.landmark||''))?null:point;}
