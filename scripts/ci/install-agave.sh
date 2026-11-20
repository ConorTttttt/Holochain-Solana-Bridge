#!/usr/bin/env bash
# Install the Agave (Solana) release for CI from the exact upstream release
# archive, verified against a pinned SHA-256 BEFORE extraction. Replaces the
# remote `release.anza.xyz/.../install` script (version-pinned only).
# Mirrors the reviewed same-run step in integration-snapshot.yml.
# Never handles keys; installs into $HOME/.local/share/solana only.
set -euo pipefail
source scripts/ci/toolchain.env
: "${SOLANA_VERSION:?}" "${AGAVE_ARCHIVE_SHA256:?pinned archive digest required}"
[[ "$AGAVE_ARCHIVE_SHA256" =~ ^[0-9a-f]{64}$ ]] || { echo 'AGAVE_DIGEST_FORMAT' >&2; exit 2; }
url="https://github.com/anza-xyz/agave/releases/download/v${SOLANA_VERSION}/solana-release-x86_64-unknown-linux-gnu.tar.bz2"
dest="$HOME/.local/share/solana"
mkdir -p "$dest" ci-artifacts
archive="$(mktemp -t "agave-${SOLANA_VERSION}.XXXXXXXX.tar.bz2")"
trap 'rm -f "$archive"' EXIT
curl --fail --show-error --silent --location --proto '=https' --tlsv1.2 --retry 3 "$url" -o "$archive"
printf '%s  %s\n' "$AGAVE_ARCHIVE_SHA256" "$archive" | sha256sum --check
while IFS= read -r entry; do
  case "$entry" in solana-release/*) ;; *) echo "UNSAFE_AGAVE_ARCHIVE_PATH: $entry" >&2; exit 1;; esac
done < <(tar -tjf "$archive")
tar -xjf "$archive" -C "$dest"
test -x "$dest/solana-release/bin/solana-test-validator"
actual="$("$dest/solana-release/bin/solana" --version | awk '{print $2}')"
[ "$actual" = "$SOLANA_VERSION" ] || { echo "AGAVE_VERSION_MISMATCH: $actual" >&2; exit 1; }
printf '%s  %s\n' "$AGAVE_ARCHIVE_SHA256" "solana-release-x86_64-unknown-linux-gnu.tar.bz2 (v${SOLANA_VERSION})" > ci-artifacts/agave-archive.sha256
sha256sum "$dest/solana-release/bin/solana" > ci-artifacts/agave-executable.sha256
if [ -n "${GITHUB_PATH:-}" ]; then echo "$dest/solana-release/bin" >> "$GITHUB_PATH"; fi
echo "AGAVE_${SOLANA_VERSION}_INSTALLED_FROM_SHA256_PINNED_ARCHIVE"
