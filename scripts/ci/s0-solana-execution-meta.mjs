/**
 * Integration-only pinned port of Agent 3's sameSolanaExecutionMeta comparison.
 * Source: OBS PR #36 @ 2931c5fc51736e3c845cb9bedc55c578534b53a1
 * Source file: observer/src/indexer.mjs (canonical/sameJSON/helper section).
 * This staging harness does NOT substitute for adopting reviewed OBS source
 * and does NOT provide independent Solana consensus verification.
 * Preserve exact signed transaction and block wire equality in calling code.
 */
function canonical(x) {
  if (Array.isArray(x)) return x.map(canonical);
  if (x && typeof x === 'object') return Object.fromEntries(
    Object.entries(x).filter(([,value])=>value!==undefined).sort(([a],[b])=>a.localeCompare(b))
      .map(([k,v])=>[k,canonical(v)]));
  return x;
}
const sameJSON = (a,b) => JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
/**
 * RPC getBlock(rewards:false) supplies meta.rewards=null while getTransaction
 * can supply meta.rewards=[]. These mean the same *empty rewards* response.
 * Do not normalize omitted fields, nonempty rewards, or any execution metadata.
 */
export function sameSolanaExecutionMeta(a,b) {
  const normalize = meta => meta && typeof meta === 'object' && !Array.isArray(meta)
    ? {...meta, rewards:meta.rewards === null ? [] : meta.rewards}
    : meta;
  return sameJSON(normalize(a),normalize(b));
}
