# Preserving the original #66 evidence (P0, deadline 2026-11-28 22:37 UTC)

The historical installation request (`../evidence/installation-request.prepared.json`) and `../baseline.json` are bound to the **original** GitHub Actions archives of #66 run [43648980986](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43648980986) at source `03b567a992bcd31930b49d08f594a4ef7ff58680`.

GitHub deletes those archives at **2026-11-28 22:37–22:58 UTC**. After that, `installation-preparation.yml` fails closed, because `fetch-originals.py` can no longer download them. A rebuild does **not** replace them: it is a different execution with different bytes.

## Status (2026-11-20)

| Item | Status |
|---|---|
| Pins for all four archives | `pr66-originals-manifest.json` (consistent with `../baseline.json`; enforced by the script) |
| Independent download + SHA-256 + size + CRC | **DONE 2026-11-20 15:57 UTC**, 4/4. See `independent-verification-2026-11-20.json` |
| Restore → **unchanged** `verify-originals.mjs` | **DONE locally**. The inventory equals the committed `../evidence/original-build-inventory.json` (19/19 fields). CI repeats this (`original-evidence-preservation.yml`) |
| Interim copy | a 90-day Actions artifact from `original-evidence-preservation.yml` (same access as the originals). **NOT durable**; recoverable until roughly 2027-02 |
| **Durable, access-controlled copy** | **BLOCKED: owner action required.** The repository is **public**, so the archives must not be committed here. No owner-authorized private storage or credentials were available to the preparing session |

## Owner action: make the durable copy (about 10 minutes, before 2026-11-28 22:37 UTC)

Prerequisites: `gh` authenticated as a user with write access, and Python 3 on a trusted machine. Run from a checkout of PR #68's branch (or `main` after it merges).

1. Download the originals through the authenticated API. The script verifies size, SHA-256, CRC, entry count, path safety and the run/job metadata, then writes `SHA256SUMS` and `PRESERVATION_RECORD.json`:

   ```bash
   python3 -I scripts/installation/preserve-originals.py download --out pr66-originals
   ```

2. Re-verify the bytes with the script:

   ```bash
   python3 -I scripts/installation/preserve-originals.py verify --dir pr66-originals
   ```

3. Re-verify the bytes independently of the script:

   ```bash
   (cd pr66-originals && sha256sum -c SHA256SUMS)
   ```

4. Store the bytes durably. Choose **one** option; strongest immutability first.
   - **C. Object storage with immutability.** Examples: S3 Object Lock in *compliance* mode, or a GCS bucket with a locked retention policy. Use a private bucket with least-privilege read access, and upload the whole `pr66-originals/` directory unmodified.
   - **B. A private repository** you own, for example `ConorTttttt/hsc-evidence-private`. Restrict it to invited collaborators, then commit the directory unmodified with plain git (each file is under 8 MB).
   - **A. A draft release on this repository.** Only users with write access can see draft releases, and they have no retention expiry. It is **not** WORM: anyone with write access can delete it. **Never publish it**, because publishing makes the assets public.

     ```bash
     gh release create pr66-original-evidence-43648980986 --draft \
       --repo ConorTttttt/Holochain-Solana-Bridge \
       --title "PR66 original evidence, run 43648980986 (DRAFT - DO NOT PUBLISH)" \
       --notes "Exact original GitHub Actions archives. Audit-only evidence; not installation authorization." \
       pr66-originals/*.zip pr66-originals/SHA256SUMS pr66-originals/PRESERVATION_RECORD.json
     ```

5. **Round-trip test.** Fetch the files back **from the durable location** into an empty directory, `roundtrip/`, then run:

   ```bash
   python3 -I scripts/installation/preserve-originals.py verify --dir roundtrip
   ```

6. **Restore test.** This proves the installation tooling consumes the restored bytes:

   ```bash
   rm -rf work
   ```

   ```bash
   python3 -I scripts/installation/preserve-originals.py restore --dir roundtrip --metadata api
   ```

   ```bash
   node demo/installation/verify-originals.mjs
   ```

   The resulting `work/installation-originals/verified-inventory.json` must equal `demo/installation/evidence/original-build-inventory.json`.

7. Record the result in a PR. Never include credentials or signed URLs. Record:
   - the storage kind and location (for example the bucket and object prefix, or the release tag);
   - the access restriction;
   - who verified it and when;
   - the round-trip `verify` output.

   Only then may anyone describe the evidence as **durably preserved**.

## After 2026-11-28

`fetch-originals.py` and `original-evidence-preservation.yml` will fail closed, which is intended. To re-run the installation verification:

1. Fetch the durable copy into a directory.
2. Run `preserve-originals.py restore --dir <copy> --metadata api`. Run and job metadata outlive the artifact bytes, and expiry is tolerated in restore mode. If the API is unavailable, use `--metadata record`, which relies on the snapshot sealed into `PRESERVATION_RECORD.json`.
3. Run the unchanged `node demo/installation/verify-originals.mjs`.

Restoration never rebuilds, repacks or substitutes evidence. It refuses any byte, size, CRC, entry-count, path-safety or metadata mismatch. It never executes archive content, and it involves no conductor, keystore, signing, installation or zome call.

Every artifact preserved here carries the denials `creditEligible:false`, `independentConsensusVerified:false`, `spendableBaseUnits:"0"`, `withdrawalAuthorized:false`. A preserved archive is evidence of a past build, **not** authorization to install it.
