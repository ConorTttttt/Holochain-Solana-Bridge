import test from 'node:test';import assert from 'node:assert/strict';import {decode} from './msgpack.mjs';
test('bundle decoder refuses duplicate keys, truncation and trailing bytes',()=>{
 for(const b of [[0x82,0xa1,97,1,0xa1,97,2],[0xc6,0,0,0,10,1],[0xc0,0]])assert.throws(()=>decode(Buffer.from(b)));
 assert.equal(decode(Buffer.from([0x81,0xa1,97,0xc3])).a,true);
});
