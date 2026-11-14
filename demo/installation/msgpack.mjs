// Bounded, dependency-free decoder for gzip MessagePack Holochain bundles.
// Unsupported extensions and duplicate map keys fail closed.
import assert from 'node:assert/strict';
export function decode(buf){
  assert.ok(buf.length<=64*1024*1024);let offset=0,nodes=0;
  function bytes(n){assert.ok(Number.isSafeInteger(n)&&n>=0&&offset+n<=buf.length,'TRUNCATED_MSGPACK');const b=buf.subarray(offset,offset+n);offset+=n;return b}
  const uint=n=>{const b=bytes(n);return n===1?b[0]:n===2?b.readUInt16BE():b.readUInt32BE()};
  const str=n=>new TextDecoder('utf-8',{fatal:true}).decode(bytes(n));
  function list(n,d){assert.ok(n<=100000);return Array.from({length:n},()=>value(d+1))}
  function map(n,d){assert.ok(n<=100000);const out=Object.create(null);for(let i=0;i<n;i++){const k=value(d+1);assert.equal(typeof k,'string');assert.ok(!Object.hasOwn(out,k),'DUPLICATE_MSGPACK_KEY');out[k]=value(d+1)}return out}
  function value(d=0){assert.ok(d<64&&++nodes<1000000);const t=uint(1);
    if(t<128)return t;if(t>=224)return t-256;
    if((t&224)===160)return str(t&31);if((t&240)===144)return list(t&15,d);if((t&240)===128)return map(t&15,d);
    if(t===192)return null;if(t===194)return false;if(t===195)return true;
    if([196,197,198].includes(t))return bytes(uint(2**(t-196)));
    if([204,205,206].includes(t))return uint(2**(t-204));
    if(t===207){const b=bytes(8);const x=b.readBigUInt64BE();assert.ok(x<=BigInt(Number.MAX_SAFE_INTEGER));return Number(x)}
    if([217,218,219].includes(t))return str(uint(2**(t-217)));
    if(t===220||t===221)return list(uint(t===220?2:4),d);
    if(t===222||t===223)return map(uint(t===222?2:4),d);
    throw Error('UNSUPPORTED_MSGPACK_TYPE:'+t);
  }
  const result=value();assert.equal(offset,buf.length,'TRAILING_MSGPACK_BYTES');return result;
}
