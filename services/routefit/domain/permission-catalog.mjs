// Permission catalog served by GET /api/ops/v1/permission-catalog (CMP-1708).
// Seeded from the contract example (22 board-named + 4 notification + existing). Labels are demo placeholders (示例),
// to be replaced by configurable labels; add new module permissions here as modules ship.
const entries=[
 ["ads",["ads:approve","ads:offline","ads:read","ads:write"]],
 ["audit",["audit:read"]],
 ["coupons",["coupons:approve","coupons:create","coupons:read","coupons:risk:resolve","coupons:stop"]],
 ["customer:ads",["customer:ads:read","customer:ads:report"]],
 ["customer:notifications",["customer:notifications:read","customer:notifications:write"]],
 ["customer:quotes",["customer:quotes:trial"]],
 ["dashboard",["dashboard:read"]],
 ["delivery",["delivery:config"]],
 ["dispatch",["dispatch:optimize","dispatch:optimize:adopt"]],
 ["driver:ads",["driver:ads:read","driver:ads:report"]],
 ["driver:notifications",["driver:notifications:read","driver:notifications:write"]],
 ["drivers",["drivers:application:review","drivers:read","drivers:suspend"]],
 ["finance",["finance:cash:policy"]],
 ["kpi",["kpi:adjust","kpi:appeal:decide","kpi:read","kpi:rule:approve","kpi:rule:submit"]],
 ["merchants",["merchants:approve","merchants:contract:approve","merchants:contract:submit","merchants:create","merchants:read"]],
 ["open:orders",["open:orders:cancel","open:orders:create","open:orders:read"]],
 ["open:quotes",["open:quotes:create"]],
 ["open:tracking",["open:tracking:read"]],
 ["openapi",["openapi:clients:read","openapi:clients:write","openapi:keys:manage","openapi:logs:read","openapi:webhooks:manage"]],
 ["payouts",["payouts:approve","payouts:confirm-paid","payouts:read"]],
 ["payroll",["payroll:read","payroll:run","payroll:scheme:approve","payroll:scheme:submit","payroll:submit"]],
 ["pricing",["pricing:config:read","pricing:config:submit"]],
 ["roles",["roles:read","roles:write"]],
 ["staff",["staff:read","staff:write"]],
 ["users",["users:freeze","users:read"]],
 ["vehicles",["vehicles:read"]]
];
export const PERMISSION_MODULES=entries.map(([module,codes])=>({module,label:module+'（示例标签）',permissions:codes.map(code=>({code,label:code+'（示例）'}))}));
export const PERMISSION_CODES=new Set(entries.flatMap(([,codes])=>codes));
export const permissionCatalogVersion=()=>{let h=7;for(const code of [...PERMISSION_CODES].sort())for(const ch of code)h=(h*31+ch.charCodeAt(0))%9000000000000;return h+1;};
