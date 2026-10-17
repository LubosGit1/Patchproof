# PatchProof

PatchProof is an open-source project to test whether a proposed security fix
removes a vulnerability without breaking expected application behaviour. It is
being built in small, tested phases; the verification engine and vulnerable
demonstration application are not implemented yet.

## Development setup

Requirements: Node.js 22.13 or newer within the Node 22 major release, and npm.

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run dev -- --help
```

The dependency versions are pinned in `package.json` and `package-lock.json`.
The CLI currently provides only its bootstrap help; verification, providers,
benchmarking, and their design documentation will arrive in later phases.

## Docker

Build and run the CLI scaffold:

```sh
docker build -t patchproof .
docker run --rm patchproof --help
```

This image is only a packaging example. It is **not** the isolated sandbox for
running untrusted patches; that boundary will be designed and tested in the
verification-pipeline phase.

## Project status

The `lab/` directory contains three deliberately vulnerable snapshots (SQL
injection, IDOR, and path traversal), their fixed reference implementations,
security/regression/holdout tests, and known-bad patches. Tests bind only to
loopback on an ephemeral port. `npm test` confirms both that the original
snapshots are exploitable and that the reference fixes pass the checks.

**The vulnerable snapshots are for this bundled lab only. Never deploy or
expose them to a network.** They are not used as the default application.
