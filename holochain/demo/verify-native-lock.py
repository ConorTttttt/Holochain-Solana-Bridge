#!/usr/bin/env python3
"""Review native HAM lock provenance, not a substitute for Cargo --locked or compilation."""
from __future__ import annotations

import argparse
from collections import Counter
from hashlib import sha256
from pathlib import Path
import re
import sys
import tomllib

REV = "fbb4b6eb8a79a507e9453b709ed00f15c5618fb4"
ROOT = "solana-audit-ham-adapter"
DIRECT = {"anyhow", "ham", "holo_hash", "holochain_client", "serde", "serde_json", "tokio"}
REGISTRY = "registry+https://github.com/rust-lang/crates.io-index"
HAM_SOURCE = f"git+https://github.com/unytco/ham?rev={REV}#{REV}"
REF = re.compile(r"([A-Za-z0-9_-]+)(?: ([0-9]+\\.[0-9]+\\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?))?\\Z")


def refuse(reason):
    raise ValueError("NATIVE_LOCK_REFUSED:" + reason)


def review(manifest, lock):
    m = tomllib.loads(manifest.read_text(encoding="utf-8"))
    if m.get("workspace") != {"resolver": "2"}:
        refuse("STANDALONE_WORKSPACE_REQUIRED")
    pkg = m.get("package", {})
    if (pkg.get("name"), pkg.get("version"), pkg.get("edition")) != (ROOT, "0.1.0", "2021"):
        refuse("ROOT_MANIFEST_CHANGED")
    deps = m.get("dependencies", {})
    if set(deps) != DIRECT:
        refuse("DIRECT_DEPENDENCIES_CHANGED")
    if deps["ham"] != {"git": "https://github.com/unytco/ham", "rev": REV}:
        refuse("HAM_REV_CHANGED")
    if deps["holochain_client"] != "=0.9.1" or deps["holo_hash"] != "=0.7.1":
        refuse("CLIENT_HASH_PIN_CHANGED")
    if deps["serde"] != {"version": "1", "features": ["derive"]}:
        refuse("SERDE_FEATURES_CHANGED")
    if deps["tokio"] != {"version": "1", "features": ["full"]}:
        refuse("TOKIO_FEATURES_CHANGED")
    if deps["anyhow"] != "1" or deps["serde_json"] != "1":
        refuse("DIRECT_RANGE_CHANGED")

    raw = lock.read_bytes()
    document = tomllib.loads(raw.decode("utf-8"))
    if document.get("version") != 4 or not isinstance(document.get("package"), list):
        refuse("LOCK_FORMAT")
    entries = document["package"]
    if not entries:
        refuse("EMPTY_LOCK")
    names = {}
    seen = set()
    sources = Counter()
    for p in entries:
        source = p.get("source", "")
        identity = (p["name"], p["version"], source)
        if identity in seen:
            refuse("DUPLICATE_PACKAGE:" + p["name"])
        seen.add(identity)
        names.setdefault(p["name"], []).append(p)
        if source == REGISTRY:
            sources["registry"] += 1
            if not re.fullmatch(r"[0-9a-f]{64}", p.get("checksum", "")):
                refuse("REGISTRY_CHECKSUM:" + p["name"])
        elif source == HAM_SOURCE and p["name"] == "ham":
            sources["git"] += 1
            if "checksum" in p:
                refuse("GIT_CHECKSUM_UNEXPECTED")
        elif source == "" and p["name"] == ROOT:
            sources["path"] += 1
        else:
            refuse("UNEXPECTED_SOURCE:" + p["name"])
    for p in entries:
        for dep in p.get("dependencies", []):
            match = REF.fullmatch(dep) if isinstance(dep, str) else None
            if not match:
                refuse("INVALID_REFERENCE")
            name, version = match.groups()
            resolved = [x for x in names.get(name, []) if version is None or x["version"] == version]
            if len(resolved) != 1:
                refuse("AMBIGUOUS_OR_MISSING_REFERENCE:" + p["name"] + "->" + dep)
    for name, version in {"ham": "0.3.0", "holochain_client": "0.9.1", "holo_hash": "0.7.1"}.items():
        if len(names.get(name, [])) != 1 or names[name][0]["version"] != version:
            refuse("PINNED_DEPENDENCY_CHANGED:" + name)
    roots = names.get(ROOT, [])
    if len(roots) != 1 or roots[0].get("source", "") or set(roots[0].get("dependencies", [])) != DIRECT:
        refuse("ROOT_LOCK_DEPENDENCIES_CHANGED")
    if sources != {"registry": 412, "git": 1, "path": 1}:
        refuse("GRAPH_SHAPE_CHANGED_REQUIRES_REVIEW:" + str(dict(sources)))
    return sha256(raw).hexdigest(), len(entries)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    root = Path(__file__).resolve().parent / "ham-adapter"
    parser.add_argument("--manifest", type=Path, default=root / "Cargo.toml")
    parser.add_argument("--lock", type=Path, default=root / "Cargo.lock")
    args = parser.parse_args()
    try:
        digest, count = review(args.manifest, args.lock)
    except (OSError, ValueError, UnicodeDecodeError, KeyError, TypeError) as e:
        print(f"NATIVE_LOCK_REFUSED:{type(e).__name__}:{e}", file=sys.stderr)
        return 3
    print(f"NATIVE_LOCK_STRUCTURAL_REVIEW_OK SHA256={digest} packages={count}")
    print("NOT COMPILED: next run Rust 1.95.0 Cargo metadata/tree and both --locked builds.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
