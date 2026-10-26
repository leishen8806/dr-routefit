ALTER POLICY customer_scope ON orders.draft
 USING (
  EXISTS(SELECT 1 FROM party.customer_access a JOIN party.customer c ON (c.company_id,c.id)=(a.company_id,a.customer_id)
   WHERE a.company_id=draft.company_id AND a.customer_id=draft.customer_id
    AND a.principal_id=NULLIF(current_setting('app.principal_id',true),'')::uuid AND c.status='ACTIVE')
  OR EXISTS(SELECT 1 FROM dispatch.assignment a
   WHERE a.company_id=draft.company_id AND a.order_id=draft.id
    AND a.driver_id=NULLIF(current_setting('app.principal_id',true),'')::uuid AND a.state IN ('offered','accepted'))
 )
 WITH CHECK (EXISTS(SELECT 1 FROM party.customer_access a JOIN party.customer c ON (c.company_id,c.id)=(a.company_id,a.customer_id)
  WHERE a.company_id=draft.company_id AND a.customer_id=draft.customer_id
   AND a.principal_id=NULLIF(current_setting('app.principal_id',true),'')::uuid AND c.status='ACTIVE'));
