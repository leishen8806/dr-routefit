import test from 'node:test';
import assert from 'node:assert/strict';
import {demoLoginError,loadingMarkup} from './entry-ui.mjs';
test('演示登录只接受指定端、演示口令和有效后台账号',()=>{const accounts=[{id:'A01',status:'active'},{id:'A02',status:'disabled'}];const valid={kind:'web',account:'A01',code:'DEMO'};assert.equal(demoLoginError(valid,accounts),'');for(const change of [{account:'missing'},{account:'A02'},{code:''},{code:'personal-password'},{kind:'unknown'}])assert.ok(demoLoginError({...valid,...change},accounts));assert.equal(demoLoginError({...valid,kind:'driver'},[]),'');assert.equal(demoLoginError({...valid,kind:'customer'},[]),'');});
test('加载组件转义文本，声明忙碌且不伪造进度百分比',()=>{const html=loadingMarkup('<img src=x>');assert.ok(html.includes('&lt;img src=x&gt;'));assert.ok(html.includes('aria-busy="true"'));assert.ok(!html.includes('100%'));});
