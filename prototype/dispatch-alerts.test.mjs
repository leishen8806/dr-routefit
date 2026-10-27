import test from 'node:test';import assert from 'node:assert/strict';import {filterAlertsByRole} from './dispatch-ui.mjs';
const alerts=[{owner:'调度'},{owner:'财务'},{owner:'调度 / 仓库'}];
test('notice filtering is role-specific while dispatch queue can remain full',()=>{assert.equal(filterAlertsByRole(alerts,'dispatch').length,2);assert.equal(filterAlertsByRole(alerts,'finance').length,1);assert.equal(filterAlertsByRole(alerts,'warehouse').length,1);});
