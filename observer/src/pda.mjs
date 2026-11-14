import { getProgramDerivedAddress } from '@solana/kit';
import { addressBytes } from './decode.mjs';

/** PDA seeds must track the compiled Anchor IDL, not just the Rust prototype. */
export async function deriveBridgeAddresses({ program, mint, depositor, nonce }) {
  addressBytes(program); addressBytes(mint); addressBytes(depositor);
  if (typeof nonce !== 'bigint' || nonce < 0n || nonce > 0xffff_ffff_ffff_ffffn) {
    throw new Error('Receipt nonce must be a u64 bigint');
  }
  const nonceBytes = Buffer.alloc(8);
  nonceBytes.writeBigUInt64LE(nonce);
  const [config, configBump] = await getProgramDerivedAddress({
    programAddress: program, seeds: ['config'],
  });
  const [vault, vaultBump] = await getProgramDerivedAddress({
    programAddress: program, seeds: ['vault', addressBytes(mint)],
  });
  const [receipt, receiptBump] = await getProgramDerivedAddress({
    programAddress: program,
    seeds: ['deposit', addressBytes(depositor), nonceBytes],
  });
  return Object.freeze({ config, configBump, vault, vaultBump, receipt, receiptBump });
}
