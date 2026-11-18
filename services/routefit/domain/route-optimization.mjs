export function planOptimizationRoutes({vehicles,orders}){
 const remaining=new Map(vehicles.map(vehicle=>[vehicle.id,vehicle.capacityVolume]));
 const selected=[];
 const routes=new Map();
 const vehicleOrder=[...vehicles].sort((a,b)=>a.capacityVolume-b.capacityVolume||a.id.localeCompare(b.id));
 const unassignedOrderIds=[];
 for(const order of [...orders].sort((a,b)=>a.id.localeCompare(b.id))){
  const vehicle=vehicleOrder.find(candidate=>
   candidate.availableSlots.includes(order.slot)&&
   (!order.requiredVehicleType||candidate.type===order.requiredVehicleType)&&
   remaining.get(candidate.id)>=order.volume
  );
  if(!vehicle){unassignedOrderIds.push(order.id);continue;}
  remaining.set(vehicle.id,remaining.get(vehicle.id)-order.volume);
  const key=`${vehicle.id}:${order.slot}`;
  const route=routes.get(key)??{vehicleId:vehicle.id,slot:order.slot,orderIds:[],usedVolume:0};
  route.orderIds.push(order.id);route.usedVolume+=order.volume;routes.set(key,route);
 }
 for(const vehicle of vehicleOrder)for(const slot of vehicle.availableSlots){const route=routes.get(`${vehicle.id}:${slot}`);if(route)selected.push(route);}
 return {routes:selected,unassignedOrderIds};
}
