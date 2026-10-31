import {rolePermissions} from '../scripts/trial-common.mjs';

export const developmentOrderQuotePermissions=rolePermissions.order_quote;

export const developmentBootstrapCaseDeciderPermissions=rolePermissions.case_decider;

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
