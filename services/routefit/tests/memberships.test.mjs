import test from 'node:test';
import assert from 'node:assert/strict';
import {inviteCustomerMember,portalMemberQuery,updateCustomerMember} from '../adapters/memberships.mjs';

const principal={companyId:'11111111-1111-4111-8111-111111111111',principalId:'22222222-2222-4222-8222-222222222222'},customerId='33333333-3333-4333-8333-333333333333',personId='44444444-4444-4444-8444-444444444444',memberId='55555555-5555-4555-8555-555555555555';
const currentCustomer='SELECT c.id FROM party.customer c JOIN party.customer_access';
const actor='SELECT person_id FROM org.principal';
const activeMembership="SELECT permissions FROM party.portal_membership";

test('customer member invitations cannot delegate a permission the inviter lacks',async()=>{
 const client={query:async sql=>{
  if(sql.startsWith(currentCustomer))return {rows:[{id:customerId}]};
  if(sql.startsWith(actor))return {rows:[{person_id:personId}]};
  if(sql.startsWith(activeMembership))return {rows:[{permissions:['ORDERS_READ','MEMBERS_MANAGE']}]};
  throw Error('Unexpected query');
 }};
 await assert.rejects(inviteCustomerMember(client,principal,{invitationEmail:'member@example.invalid',permissions:['FINANCE_READ'],expiresAt:new Date(Date.now()+60000).toISOString()}),{code:'DELEGATION_EXCEEDED'});
});

test('the final active customer members manager cannot be suspended or revoked',async()=>{
 const target={id:memberId,customer_id:customerId,person_id:personId,state:'active',permissions:['MEMBERS_MANAGE'],version:3,snapshot:{id:memberId,version:3,ownerAccountId:customerId,state:'active'}};
 const client={query:async sql=>{
  if(sql.startsWith(currentCustomer))return {rows:[{id:customerId}]};
  if(sql.startsWith(actor))return {rows:[{person_id:personId}]};
  if(sql.startsWith(activeMembership))return {rows:[{permissions:['MEMBERS_MANAGE']}]};
  if(sql.startsWith('SELECT * FROM party.portal_membership'))return {rows:[target]};
  if(sql.startsWith('SELECT count(*)::integer AS count'))return {rows:[{count:0}]};
  throw Error('Unexpected query');
 }};
 for(const kind of ['member-suspend','member-revoke'])await assert.rejects(updateCustomerMember(client,principal,kind,memberId,{reason:'offboard'},3),{code:'LAST_ADMIN_PROTECTED'});
});

test('member cursors are principal-bound and reject tampering',()=>{
 const query=portalMemberQuery(new URL('https://local.test/api/customer/v1/members?limit=5'),principal),cursor=query.cursor(memberId);
 assert.equal(portalMemberQuery(new URL('https://local.test/api/customer/v1/members?limit=5&cursor='+encodeURIComponent(cursor)),principal).after,memberId);
 assert.throws(()=>portalMemberQuery(new URL('https://local.test/api/customer/v1/members?limit=5&cursor='+encodeURIComponent(cursor+'x')),principal),{code:'INVALID_CURSOR'});
});
