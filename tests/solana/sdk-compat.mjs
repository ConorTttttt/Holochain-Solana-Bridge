// @solana/web3.js 1.98.4 is loaded as CommonJS by Node's ESM interop.
// That package does not expose BPF_LOADER_UPGRADEABLE_PROGRAM_ID as a named
// export. This is the protocol-defined loader-v3 program ID, NOT a PDA and
// NOT a test-only account owner. Source: https://solana.com/docs/core/programs/program-deployment
import web3 from '@solana/web3.js';

export const BPF_LOADER_UPGRADEABLE_PROGRAM_ID =
  new web3.PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');
