import test from 'node:test';
import assert from 'node:assert/strict';
import { accountCode, directoryMatches } from '../lib/commerce-directory.mjs';
const rows=[{id:42,kind:'CUSTOMER',name:'Mina Ahmed',phone:'+971 50 123 4567'},{id:43,kind:'CUSTOMER',name:'Sam Morgan',phone:''}];
test('customer search matches names, account codes and formatted phone numbers without treating name digits as phone searches',()=>{
  for(const q of ['mina','AHMED','CUS-000042','0501234567'.slice(1),'+971501234567','50 123 4567']) assert.equal(directoryMatches(rows,q)[0]?.id,42,q);
  assert.deepEqual(directoryMatches(rows,'Customer 50123'),[]);
  assert.equal(directoryMatches(rows,'')[1].id,43);
  assert.equal(accountCode({id:7,kind:'SUPPLIER'}),'SUP-000007');
});
