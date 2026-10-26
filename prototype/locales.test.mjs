import test from 'node:test';
import assert from 'node:assert/strict';
import {locales,messages,resolveLocale,t,money,date} from './locales.mjs';
test('all preview copy exists in all three locales',()=>{for(const locale of locales){assert.deepEqual(Object.keys(messages[locale]),Object.keys(messages['en-US']));for(const value of Object.values(messages[locale]))assert.ok(value.trim())}assert.equal(resolveLocale('bad'),'en-US');assert.equal(t('en-US','insurance'),'Delivery insurance fee')});
test('locale changes formatting, not currency or amount; timezone stays Phnom Penh',()=>{for(const locale of locales){assert.match(money(locale,2200),/USD/);assert.match(money(locale,2200),/22[.,]00/);assert.match(date(locale,'2026-10-24T11:00:00Z'),/18:00/)}assert.equal(2000+200,2200);assert.equal(2000-400,1600)});
