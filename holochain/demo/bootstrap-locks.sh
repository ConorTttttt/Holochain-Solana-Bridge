#!/usr/bin/env bash
# Networked Rust 1.95.0 dependency-bootstrap gate for OUR OWN audit DNA.
# This produces candidate locks; it never stages, commits, approves or signs.
set -euo pipefail
cd "$(dirname "$0")"
mode="${1:-generate}"
if [[ "$mode" != generate && "$mode" != verify ]]; then
  echo 'USAGE: bootstrap-locks.sh [generate|verify]' >&2
  exit 2
fi
for tool in cargo rustc python3 sha256sum git; do
  command -v "$tool" >/dev/null || { echo "BLOCKED: missing $tool" >&2; exit 2; }
done
if ! rustc +1.95.0 --version | grep -q 'rustc 1.95.0 '; then
  echo 'BLOCKED: require Rust 1.95.0 for dependency resolution' >&2
  exit 2
fi
echo 'A4 candidate lock source (not a compiled or authorized runtime):'
git rev-parse HEAD
cargo +1.95.0 --version
# Do not resolve a working tree whose pinned manifests differ from HEAD.
if [[ -n "$(git status --porcelain --untracked-files=no -- Cargo.toml integrity/Cargo.toml coordinator/Cargo.toml ham-adapter/Cargo.toml)" ]]; then
  echo 'BLOCKED: Cargo manifests differ from HEAD' >&2
  exit 3
fi
if [[ "$mode" == generate ]]; then
  for lock in Cargo.lock ham-adapter/Cargo.lock; do
    if [[ -e "$lock" ]]; then
      echo "BLOCKED: $lock already exists; use verify rather than overwriting" >&2
      exit 3
    fi
  done
  cargo +1.95.0 generate-lockfile --manifest-path Cargo.toml
  cargo +1.95.0 generate-lockfile --manifest-path ham-adapter/Cargo.toml
fi
for lock in Cargo.lock ham-adapter/Cargo.lock; do
  [[ -s "$lock" ]] || { echo "BLOCKED: missing generated $lock" >&2; exit 3; }
done
python3 - <<'PY'
import pathlib, re, tomllib
from collections import Counter

root = pathlib.Path(".")
with (root / "Cargo.toml").open("rb") as f:
    wasm_manifest = tomllib.load(f)
with (root / "ham-adapter/Cargo.toml").open("rb") as f:
    native_manifest = tomllib.load(f)
for name, version in {"hdk": "=0.7.1", "hdi": "=0.8.1"}.items():
    assert wasm_manifest["workspace"]["dependencies"][name] == version, f"manifest {name} pin changed"
for name, version in {"holochain_client": "=0.9.1", "holo_hash": "=0.7.1"}.items():
    assert native_manifest["dependencies"][name] == version, f"native manifest {name} pin changed"
rev = "fbb4b6eb8a79a507e9453b709ed00f15c5618fb4"
ham_manifest = native_manifest["dependencies"]["ham"]
assert ham_manifest["git"] == "https://github.com/unytco/ham" and ham_manifest["rev"] == rev, "HAM manifest pin changed"
locks = {
    "Cargo.lock": {"hdk": "0.7.1", "hdi": "0.8.1"},
    "ham-adapter/Cargo.lock": {"holochain_client": "0.9.1", "holo_hash": "0.7.1"},
}
for filename, pins in locks.items():
    with (root / filename).open("rb") as f:
        lock = tomllib.load(f)
    assert lock.get("version") in (3, 4), f"unsupported Cargo.lock format in {filename}"
    packages = lock["package"]
    seen = Counter(p["name"] for p in packages)
    for name, version in pins.items():
        matched = [p for p in packages if p["name"] == name]
        assert len(matched) == 1 and matched[0]["version"] == version, f"{filename}: unexpected {name} resolution"
    for p in packages:
        source = p.get("source", "")
        if source.startswith("registry+"):
            assert re.fullmatch(r"[0-9a-f]{64}", p.get("checksum", "")), f"{filename}: unchecked registry crate {p['name']}"
        if source.startswith("git+"):
            assert re.search(r"#[0-9a-f]{40}$", source), f"{filename}: missing immutable Git commit for {p['name']}"
    if filename.startswith("ham-adapter"):
        ham = [p for p in packages if p["name"] == "ham"]
        assert len(ham) == 1, "HAM dependency absent or ambiguous"
        expected = f"git+https://github.com/unytco/ham?rev={rev}#{rev}"
        assert ham[0].get("source") == expected, "HAM source is NOT the reviewed immutable revision"
    print(f"RESOLVED {filename}: {len(packages)} packages, pinned roots: " +
          ", ".join(f"{name}={version}" for name, version in pins.items()))
    print("  NOTE: every transitive addition/change and package license still needs independent review")
PY
# Cargo tree independently verifies that the generated resolver graph is usable
# with the locked manifests. Logs are public dependency names, not credentials.
echo 'LOCKED WASM DEPENDENCY GRAPH:'
cargo +1.95.0 tree --locked --manifest-path Cargo.toml --target wasm32-unknown-unknown
echo 'LOCKED NATIVE HAM DEPENDENCY GRAPH:'
cargo +1.95.0 tree --locked --manifest-path ham-adapter/Cargo.toml
echo 'CANDIDATE LOCK SHA-256 (review these exact bytes before committing):'
sha256sum Cargo.lock ham-adapter/Cargo.lock
echo 'CANDIDATE LOCKS ONLY: independent review, commits, --locked build, genuine Solana scope, own-DNA install and authorization STILL REQUIRED.'
