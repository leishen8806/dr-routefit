async(page)=>{
 await page.goto('http://127.0.0.1:4173/prototype/#dispatch');await page.reload();await page.setViewportSize({width:1440,height:1100});await page.locator('[data-role=dispatch]').first().click();await page.locator('[data-action=busy-scenario]').click();
 const state=()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('routefit-r1-prototype-v1')));
 const n=(await state()).orders.length;await page.locator('[data-action=busy-scenario]').click();if((await state()).orders.length!==n)throw Error('duplicate scenario');
 await page.locator('[data-dispatch-tab=alerts]').click();if(await page.locator('.dispatch-alert.urgent').count()<1)throw Error('urgent missing');
 await page.locator('[data-alert-order="RF-DEMO-204"]').first().click();await page.locator('.order-expand>summary').click();if(!(await page.locator('.order-detail').last().innerText()).includes('RF-DEMO-204'))throw Error('alert did not select');if(!await page.locator('[data-action=authorizeReturn]').count())throw Error('return action missing');
 await page.locator('[data-dispatch-tab=overview]').click();await page.locator('[data-stage=in_transit]').click();if(!(await page.locator('tbody').innerText()).includes('RF-DEMO-203'))throw Error('stage filter failed');await page.locator('[data-filter=all]').click();
 await page.locator('[data-dispatch-tab=alerts]').click();await page.locator('[data-action=all-alerts]').click();if(!await page.getByRole('heading',{name:'异常与退回',exact:true}).count())throw Error('all alerts failed');await page.locator('[data-nav=dispatch]').click();await page.waitForTimeout(4600);await page.screenshot({path:'E:/Dr.RouteFit/prototype/screenshots/dispatch-expanded.png',fullPage:true});
 for(const width of [1280,390]){await page.setViewportSize({width,height:900});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('overflow '+width)}
 await page.setViewportSize({width:1440,height:1100});return {status:'PASS',orders:n,checks:['rich demo fixtures and idempotent loading','urgent cards','alert to actionable order','stage filter','all alerts queue','1280 / 390 no page overflow']};
}
