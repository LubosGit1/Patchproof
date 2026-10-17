# Methodology

## Research question

Can an automated verifier distinguish a fix that removes a demonstrated
vulnerability while preserving the case's intended behaviour from patches
that merely satisfy visible security checks?

PatchProof is a small engineering demonstration, not a statistically
representative study of AI coding agents or a benchmark of production
software.

## Cases and procedure

The experiment currently contains three bundled, deliberately vulnerable
local API cases:

| Case | Weakness | Security check | Independent checks |
|---|---|---|---|
| `sql-injection` | SQL injection, CWE-89 | Mutated attacker-controlled email inputs must not alter query results | Holdout boolean expression; existing-account behaviour |
| `idor` | Broken object-level authorization, CWE-639 | A user cannot fetch another user's invoices | Third-party invoice holdout; owner and unauthenticated behaviour |
| `path-traversal` | Path traversal, CWE-22 | Traversal paths must not read the lab's private fixture | Normalized-path holdout; published-file behaviour |

Each case has an original vulnerable snapshot and a reproduction test. Before
testing a candidate, the sandbox must observe the security test fail with an
assertion failure on the original code and the reproduction test pass. If that
precondition does not hold, the run is not treated as evidence about the
candidate.

The verifier statically restricts a candidate to one unified diff for the
case's `source.ts`. It then copies the case into the isolated container,
applies the patch there, and runs the security, visible regression, holdout,
and behaviour stages separately. The tests and candidate code run in the
container, not on the host.

## Prompt and holdouts

The provider prompt includes the vulnerable source, the case description,
visible security tests, and visible regression tests. It excludes the
reference fix, known-bad patches, and holdout tests. Proposal evidence stores
the exact prompt text, provider/model ID, generation parameters, vulnerable
source hash, and patch hash.

Holdouts are separate tests targeting a different input or behaviour from the
visible test. They are intended to catch exact-string blacklists and
endpoint-disabling patches. They are independent in execution and withheld
from the model prompt, but not secret from people: the repository is public
and contains the test files. Results must not be described as blind testing
against a model with repository access.

## Verdict definitions

Each benchmark attempt receives one primary verifier verdict:

- `VERIFIED_FIX`: baseline reproduction is valid, the patch validates/applies,
  security and visible regression tests pass, and all holdout and behaviour
  tests pass.
- `FAILED_FIX`: the original case reproduces, but at least one visible
  security test still fails after patching.
- `REGRESSION`: visible security checks pass but visible application behaviour
  regresses.
- `FALSE_SUCCESS`: visible security checks pass, but a holdout or behaviour
  check fails.
- `INVALID_PATCH`: static validation rejects the patch or it cannot be applied
  cleanly.
- `INVALID_CASE`: the vulnerability cannot be reliably reproduced from the
  original snapshot.
- `SANDBOX_ERROR`: Docker or the runner fails before a result can be
  established.

The order matters: a patch that still fails a visible security test is
classified as `FAILED_FIX`, even if another test also fails.

## Metrics

For `N` attempts, a verdict rate is `count(verdict) / N * 100`. The report
includes counts and percentages for each verdict overall and per case.

The naive checker accepts an attempt if its visible security stage passes.
`naive.accepted` counts all such attempts. `naive.falseAccepts` counts naive
accepts whose PatchProof verdict is not `VERIFIED_FIX`. `patchProofVerified`
counts only `VERIFIED_FIX` verdicts. This comparison demonstrates the
additional checks' effect on the bundled deterministic fixtures; it is not an
estimate of real-world false-positive/false-negative rates.

Mock benchmark attempts cycle deterministically through a known-good patch, an
ineffective patch, a narrow blacklist, an endpoint-disabling patch, and an
invalid patch. This validates the experiment wiring and ensures CI can show at
least one false success rejected. It is not a model-quality result.

## Reproducibility

The benchmark writes JSON and Markdown artifacts under
`results/benchmarks/<benchmark-id>/`. Each attempt links to a proposal record
and verification evidence. The proposal record captures the exact prompt,
provider and returned model ID, parameters, and content hashes. The benchmark
records provider, attempts per case, creation time, Node version, per-case
verdicts, and evidence paths. Dependencies are pinned in the npm manifests and
lockfile, and the sandbox base image uses a pinned Node 22 patch release.

Mock runs require no API key. Live Anthropic runs are manually triggered and
may vary as hosted models change. The report records the returned model ID and
prompt/configuration; the API service itself is outside this repository's
reproducibility control.

## Threats to validity

- **Small sample of cases:** three synthetic endpoints cannot represent the
  variety of frameworks, databases, authorization models, and deployment
  setups.
- **Test-oracle limits:** finite visible and holdout tests can miss exploitable
  inputs and unintended behaviour. `VERIFIED_FIX` is case-scoped evidence,
  not a proof of universal safety.
- **Public holdouts:** tests are withheld from the prompt but publicly
  inspectable in the repository. A model that can inspect the checkout may
  discover them.
- **Mock construction:** canned patches intentionally exercise verifier
  paths; their rates say nothing about the capabilities of an LLM.
- **Model/API drift:** Anthropic responses can change with service and model
  revisions; a recorded model identifier and prompt cannot freeze the remote
  service.
- **Sandbox assumptions:** Docker shares the host kernel, and container
  isolation may have vulnerabilities or be misconfigured by the operator.
- **Environment effects:** resource limits, test timing, Docker version, and
  host architecture can affect execution. A sandbox error is not a successful
  verification.
- **Benchmark selection:** all cases and bad patches are hand-authored and
  selected by the project owner; there is no independent external validation
  of the case suite.
