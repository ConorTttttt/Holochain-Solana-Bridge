#!/usr/bin/env node
import {readFileSync,writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
import {compareAdminSnapshots} from '../../demo/installation/identity.mjs';
assert.equal(process.argv.length,6,'Usage: <request.json> <list-apps.json> <list-cells.json> <output.json>');
const [r,a,c,out]=process.argv.slice(2);const load=p=>JSON.parse(readFileSync(p));
writeFileSync(out,JSON.stringify(compareAdminSnapshots(load(r),load(a),load(c)),null,2)+'\n',{flag:'wx',mode:0o600});
