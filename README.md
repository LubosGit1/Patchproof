# PatchProof

PatchProof is an open-source project to test whether a proposed security fix
removes a vulnerability without breaking expected application behaviour. It is
being built in small, tested phases; the verification engine and vulnerable
demonstration application are not implemented yet.

## Development setup

Requirements: Node.js 22 and npm.

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

The `lab/` directory, once added, will contain intentionally vulnerable code
for local demonstrations only and must never be deployed.
