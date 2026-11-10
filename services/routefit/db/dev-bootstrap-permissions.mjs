import {rolePermissions} from '../scripts/trial-common.mjs';

export const developmentOrderQuotePermissions=rolePermissions.order_quote;

export const developmentBootstrapCaseDeciderPermissions=rolePermissions.case_decider;

export const developmentDriverPermissions=['driver:tasks:read','driver:tasks:accept','driver:tasks:reject','driver:tasks:execute','driver:locations','driver:delivery:record','driver:custody:confirm','driver:evidence:create','driver:evidence:read','driver:sync'];

export function buildDevelopmentPermissionSets(basePermissions){
 const base=[...basePermissions];
 return [
  base,
  [...base],
  ['pricing:read','pricing:review'],
  ['pricing:read','pricing:publish'],
  ['prepayment:read','prepayment:verify','prepayment:review'],
  ['prepayment:read','prepayment:approve','prepayment:post'],
  [...developmentOrderQuotePermissions],
  [...developmentBootstrapCaseDeciderPermissions]
 ];
}
