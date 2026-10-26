const route=(prefix,subject,permission)=>[
 {method:'GET',pattern:new RegExp(`^${prefix}/ledger-items$`),operation:`${subject}Ledger`,kind:'ledger',schema:'LedgerItemPage',permission:`${permission}:finance:read`},
 {method:'GET',pattern:new RegExp(`^${prefix}/statements$`),operation:`${subject}Statements`,kind:'statements',schema:'StatementPage',permission:`${permission}:finance:read`},
 {method:'POST',pattern:new RegExp(`^${prefix}/settlement-requests$`),operation:`${subject}SettlementRequest`,kind:'settlement-request',schema:'OwnFinanceRequest',input:'PaymentDraft',permission:`${permission}:settlement:request`},
 {method:'GET',pattern:new RegExp(`^${prefix}/settlement-requests$`),operation:`${subject}Settlements`,kind:'settlement-requests',schema:'OwnFinanceRequestPage',permission:`${permission}:finance:read`},
 {method:'GET',pattern:new RegExp(`^${prefix}/settlement-accounts$`),operation:`${subject}SettlementAccounts`,kind:'settlement-accounts',schema:'AccountMaskedPage',permission:`${permission}:accounts:read`}
];
export const merchantRoutes=route('/api/merchant/v1','merchant','merchant');
export const partnerPortalRoutes=route('/api/partner/v1','partner','partner');
