import test from 'node:test';import assert from 'node:assert/strict';import {requiredReason} from './orders-ui-rules.mjs';
test('policy reason guard rejects blank review and publish notes',()=>{assert.equal(requiredReason(''),false);assert.equal(requiredReason('  '),false);assert.equal(requiredReason('发布说明'),true);});
