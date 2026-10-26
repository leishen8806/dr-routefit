import assert from 'node:assert/strict';
import test from 'node:test';
import {recipientBearer} from '../adapters/recipient.mjs';

test('recipient bearer accepts only an opaque bearer token and rejects browser cookies',()=>{
 const token='A'.repeat(43);
 assert.equal(recipientBearer({headers:{authorization:`Bearer ${token}`}}),token);
 assert.throws(()=>recipientBearer({headers:{authorization:`Bearer ${token}`,cookie:'rf_session=x'}}),error=>error.code==='RECIPIENT_TOKEN_REQUIRED');
 assert.throws(()=>recipientBearer({headers:{authorization:'Bearer short'}}),error=>error.code==='RECIPIENT_TOKEN_REQUIRED');
});
