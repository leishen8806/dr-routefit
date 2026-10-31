import {developmentCaseDeciderPermissions} from '../adapters/development-auth.mjs';

export const developmentOrderQuotePermissions=[
 'orders:read','orders:create','orders:edit','orders:verify','orders:submit',
 'areas:read','quotes:read','quotes:create','quotes:confirm','pricing:read',
 'cases:read','cases:create'
];

export const developmentBootstrapCaseDeciderPermissions=[
 ...developmentCaseDeciderPermissions,'orders:read','quotes:read','areas:read'
];

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
