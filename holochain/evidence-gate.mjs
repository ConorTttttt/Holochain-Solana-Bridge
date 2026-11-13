/** Explicitly disabled until RAVE parked-spend finality and anti-replay proofs are tested. */
export function issueHolochainCredit(_observedSolanaReceipt) {
  throw new Error('CREDITING_DISABLED: prototype deposits are refundable; there is no verified RAVE settlement or bridging authorization');
}

/** Explicitly disabled until a complete two-way protocol is audited. */
export function authorizeSolanaWithdrawal(_holochainSpend) {
  throw new Error('WITHDRAWALS_DISABLED: no safe finalized burn/reservation proof or redemption nonce ledger');
}
