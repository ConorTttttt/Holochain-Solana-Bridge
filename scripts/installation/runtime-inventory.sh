#!/usr/bin/env bash
# READ ONLY: --version and hash; no conductor, keystore or cell startup.
set -euo pipefail
root=work/installation-originals
hc --version
holochain --version
lair-keystore --version
hc dna hash "$root/build/holochain/demo/holochain_solana_audit_demo.dna" > "$root/independent-dna-hash.txt"
node --input-type=module <<'NODE'
import {readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root='work/installation-originals/';
const inventory=JSON.parse(readFileSync(root+'verified-inventory.json'));
assert.equal(readFileSync(root+'independent-dna-hash.txt','utf8').trim(),inventory.dnaHash,'INDEPENDENT_HC_DNA_HASH_DIFFERS');
const tools={};
for(const name of ['hc','holochain','lair-keystore']){
 const path=realpathSync(execFileSync('bash',['-c','command -v "$1"','bash',name],{encoding:'utf8'}).trim());
 const version=execFileSync(path,['--version'],{encoding:'utf8'}).trim();
 assert.match(version,/0\.7\.1/);
 tools[name]={path,version,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')};
}
writeFileSync(root+'runtime-inventory.json',JSON.stringify(tools,null,2)+'\n');
console.log('::notice title=Runtime executable inventory::'+JSON.stringify(tools));
NODE
