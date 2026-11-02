export function selectAddressChangeCase(items){
 const changes=(Array.isArray(items)?items:[]).filter(item=>item?.type==='ADDRESS_CHANGE');
 const open=changes.filter(item=>item.state!=='rejected');
 return open.at(-1)||changes.at(-1)||null;
}
