#!/usr/bin/env python3
"""Offline original PR #55 ZIP inspection; no consensus/epoch/economic approval."""
import base64
import hashlib
import json
import struct
import sys
import zipfile
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

EXPECTED = "33a56159b1ab680cbfc36bffb365a1195a54fbddafb89082d8efcee012c2a018"
B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
ROOT = "localnet-evidence/"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def b58decode(value):
    number = 0
    for char in value:
        number = number * 58 + B58.index(char)
    payload = number.to_bytes((number.bit_length() + 7) // 8, "big") if number else b""
    return b"\0" * (len(value) - len(value.lstrip("1"))) + payload


def shortvec(data, pos):
    total = shift = 0
    for _ in range(3):
        byte = data[pos]
        pos += 1
        total |= (byte & 127) << shift
        if byte < 128:
            return total, pos
        shift += 7
    raise ValueError("invalid Solana shortvec")


def verify_wire(raw, expected_first_signature):
    sig_count, cursor = shortvec(raw, 0)
    assert 0 < sig_count <= 32
    signatures = [raw[cursor + 64*i:cursor + 64*(i+1)] for i in range(sig_count)]
    assert all(len(s) == 64 for s in signatures)
    message = raw[cursor + 64 * sig_count:]
    assert message[0] & 0x80 == 0, "legacy witness only; no ALT shortcut"
    assert message[0] == sig_count, "message signer count mismatch"
    key_count, start = shortvec(message, 3)
    keys = [message[start + 32*i:start + 32*(i+1)] for i in range(key_count)]
    assert key_count >= sig_count and all(len(k) == 32 for k in keys)
    assert b58decode(expected_first_signature) == signatures[0]
    for signature, pubkey in zip(signatures, keys):
        Ed25519PublicKey.from_public_bytes(pubkey).verify(signature, message)
    return sig_count


def verify(zip_path):
    archive_bytes = Path(zip_path).read_bytes()
    assert sha(archive_bytes) == EXPECTED, "wrong ZIP bytes: original SHA-256 mismatch"
    with zipfile.ZipFile(zip_path) as z:
        assert z.testzip() is None, "ZIP CRC failed"
        assert len(z.namelist()) == 283 and len(set(z.namelist())) == 283
        index_bytes = z.read(ROOT + "evidence-manifest.sha256")
        entries = [line.split("  ", 1) for line in index_bytes.decode().splitlines()]
        assert len(entries) == 280, "original manifest count"
        for digest, relative in entries:
            member = ROOT + relative.removeprefix("./")
            assert sha(z.read(member)) == digest, "manifest violation: " + member
        assert sha(index_bytes) == "b92b42ff6a0b217e40212a3088ee88110010d9aefa179b080ccfbe342d1ab366"
        domain = json.loads(z.read(ROOT + "demo-source-domain.json"))
        assert domain["sourceCommitSha"] == "c071e4c98e7b2dd04a18374f3792c0a90ce4b284"
        assert domain["idlSha256"] == sha(z.read("idl/deposit_prototype.json"))
        elf = z.read("deploy/deposit_prototype.so")
        assert domain["elfSha256"] == sha(elf)
        expected_scope = sha(("HSC/demo-localnet-source-scope/v1\0"
            + domain["genesisHash"] + "\0" + domain["programId"] + "\0" + domain["mint"]).encode())
        assert expected_scope == domain["scopeHex"] == domain["initializedScopeHex"]
        for key, expected in {
            "historyComplete": False, "creditEligible": False,
            "independentConsensusVerified": False, "spendableBaseUnits": "0",
            "withdrawalAuthorized": False,
        }.items():
            assert domain[key] == expected
        accounts = json.loads(z.read(ROOT + "demo-domain-deployment-program-accounts.rpc.json"))["result"]["value"]
        prog = base64.b64decode(accounts[0]["data"][0])
        pdata = base64.b64decode(accounts[1]["data"][0])
        assert accounts[0]["owner"] == accounts[1]["owner"] == "BPFLoaderUpgradeab1e11111111111111111111111"
        assert accounts[0]["executable"] and not accounts[1]["executable"]
        assert struct.unpack_from("<I", prog)[0] == 2 and len(prog) == 36
        assert prog[4:36] == b58decode("Ay7P61LeQXPnD7mqTo5ma73qhauBd7tC6LYUXe8RdNTY")
        assert struct.unpack_from("<I", pdata)[0] == 3
        assert struct.unpack_from("<Q", pdata, 4)[0] == 0
        assert pdata[45:] == elf, "ProgramData ELF != original generated ELF"
        bundle = json.loads(z.read(ROOT + "sprint1-demo-domain-transactions.json"))
        assert bundle["sourceCommitSha"] == domain["sourceCommitSha"] and bundle["complete"]
        for label, slot, should_succeed in [
            ("initialize", 10, True), ("deposit", 42, True),
            ("duplicate", 74, False), ("refund", 75, True),
        ]:
            entry = next(record for record in bundle["finalized"] if record["slot"] == slot)
            signature = entry["signature"]
            if label != "duplicate":
                assert domain["transactions"][label]["signature"] == signature
            transaction = json.loads(z.read(ROOT + entry["getTransactionBase64RawFile"]))["result"]
            block = json.loads(z.read(ROOT + entry["getBlockBase64RawFile"]))["result"]
            assert transaction["slot"] == slot and block["blockhash"] == entry["blockhash"]
            b64 = transaction["transaction"][0]
            wire = base64.b64decode(b64)
            signer_count = verify_wire(wire, signature)
            matches = [item for item in block["transactions"] if item["transaction"][0] == b64]
            assert len(matches) == 1, "original wire not uniquely included"
            assert (transaction["meta"]["err"] is None) == should_succeed
            assert (matches[0]["meta"]["err"] is None) == should_succeed
            assert any(item.get("signedWireBase64") == b64 for item in bundle["transactions"])
            print(f"verified {label} slot={slot} signer_count={signer_count} signed_wire_sha256={sha(wire)}")
        for state in ("active", "refunded"):
            snap = json.loads(z.read(ROOT + "demo-domain-" + state + "-receipt.json"))
            assert snap["sourceCommitSha"] == domain["sourceCommitSha"]
            assert [x["address"] for x in snap["accounts"]] == [
                domain[k] for k in ("receipt", "config", "vault", "mint")]
            rpc = json.loads(z.read(ROOT + snap["getMultipleAccountsRawFile"]))["result"]["value"]
            assert [x["data"][0] for x in rpc] == [x["dataBase64"] for x in snap["accounts"]]
            print(f"verified {state} account snapshot slot={snap['slot']}")
    print("PASS: exact original ZIP, 280/280 manifest, original IDL/ELF/ProgramData, "
          "4 Ed25519 wires and blocks, 2 snapshot sidecars")
    print("LIMITS: selected blocks only, original archived RPC testimony, "
          "NO independent consensus, deployment epoch, economic authorization.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python verify-pr55-original-zip.py ORIGINAL.zip")
    verify(sys.argv[1])
