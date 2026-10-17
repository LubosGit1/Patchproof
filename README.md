# PatchProof

PatchProof is an open-source project to test whether a proposed security fix
removes a vulnerability without breaking expected application behaviour. It is
being built in small, tested phases. The current implementation verifies
unified diffs against a bundled lab, supports deterministic mock and Anthropic
providers, and runs repeatable benchmarks.

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

## Verify a patch

Docker is required. The reference patch for a case provides a quick successful
example:

```sh
npm run sandbox:build
npm run dev -- verify --case sql-injection --patch lab/cases/sql-injection/reference.patch
```

PatchProof first checks that the vulnerable snapshot is exploitable, then
applies the diff and runs the visible security tests, regressions, hidden
holdouts, and behaviour checks. It writes `verification.json` and
`verification.md` under `results/<case>/<run-id>/`.

The validator limits patches to the case's `source.ts`, rejects changes to
tests/configuration and unsafe paths, and enforces size limits. Untrusted
source is copied and executed only inside the Docker sandbox: network disabled,
read-only root filesystem, non-root user, CPU/memory/process limits, and a
bounded writable tmpfs. Docker image construction installs pinned project
dependencies before any candidate patch is run; the verification container
itself has no network and receives no host credentials.

## Propose a patch

The mock provider is deterministic and requires no credentials:

```sh
npm run dev -- propose --case sql-injection --provider mock
```

This stores `candidate.diff` and `proposal.json` under `results/proposals/`.
The JSON records the exact prompt, model ID, parameters, and hashes. Mock
attempts cycle through a reference fix, an ineffective fix, a narrow blacklist,
an endpoint-disabling patch, and an invalid diff. Use `--attempt N` to select
the deterministic scenario for an individual proposal.

Anthropic is opt-in and requires an API key from the environment. Do not put
secrets in source control:

```sh
ANTHROPIC_API_KEY=... npm run dev -- propose --case sql-injection --provider anthropic
```

`ANTHROPIC_MODEL` may override the provider's default model ID. The proposal
prompt includes only the vulnerable source, case description, and visible
security/regression tests; holdout tests and known patches are excluded.

## Benchmark

Run five deterministic mock attempts for each case (Docker required):

```sh
npm run bench -- --provider mock --attempts 5
```

The JSON and Markdown report are written under `results/benchmarks/`. Rates
are reported for each verifier verdict. The report also compares the naive
checker (accept if visible security tests pass) with PatchProof's
`VERIFIED_FIX` verdict, including naive false accepts rejected by regression,
holdout, or behaviour checks. CI runs this mock benchmark without an API key.

## Docker

Build and run the packaged CLI:

```sh
docker build -t patchproof .
docker run --rm patchproof --help
```

This regular image packages the CLI. It is not the sandbox image used for
untrusted patch execution; that image is built from `Dockerfile.sandbox`.

## Project status

The `lab/` directory contains three deliberately vulnerable snapshots (SQL
injection, IDOR, and path traversal), their fixed reference implementations,
security/regression/holdout tests, and known-bad patches. Lab tests bind only
to loopback on an ephemeral port. `npm test` confirms both that the original
snapshots are exploitable and that the reference fixes pass their checks.

**The vulnerable snapshots are for this bundled lab only. Never deploy or
expose them to a network.** They are not used as the default application.
