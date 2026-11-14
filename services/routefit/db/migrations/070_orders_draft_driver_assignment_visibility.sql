ALTER POLICY customer_scope ON orders.draft
USING(
  EXISTS(SELECT 1 FROM party.customer c WHERE c.company_id=draft.company_id AND c.id=draft.customer_id AND c.status='ACTIVE' AND (
    EXISTS(SELECT 1 FROM party.customer_access a WHERE a.company_id=c.company_id AND a.customer_id=c.id AND a.principal_id=NULLIF(current_setting('app.principal_id',true),'')::uuid)
    OR EXISTS(SELECT 1 FROM integration.service_binding b WHERE b.company_id=c.company_id AND b.principal_id=NULLIF(current_setting('app.principal_id',true),'')::uuid AND b.customer_id=c.id AND b.state='ACTIVE')
  )) OR EXISTS(SELECT 1 FROM dispatch.assignment a WHERE a.company_id=draft.company_id AND a.order_id=draft.id AND a.driver_id=NULLIF(current_setting('app.principal_id',true),'')::uuid AND a.state IN ('offered','accepted','completed','revoked','superseded'))
);
