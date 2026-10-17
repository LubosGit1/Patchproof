# Architecture decisions

These short records capture the current choices and their trade-offs. They
describe the implementation as it exists, not guarantees of future versions.

## ADR-001: Keep vulnerable targets inside a bundled lab

**Decision:** Put all intentionally vulnerable application snapshots and
their proof tests under `lab/`; bind test servers only to loopback and
ephemeral ports.

**Reason:** This keeps the experiment local and reproducible and avoids
turning PatchProof into an external-target scanner.

**Trade-off:** The cases are synthetic and do not cover arbitrary software.

## ADR-002: Use one-source unified diffs for candidates

**Decision:** Accept a single diff that changes only the case's `source.ts`,
with strict path, format, size, changed-line, and no-fuzz apply checks.

**Reason:** This sharply limits the candidate's ability to edit tests,
configuration, dependencies, or the runner.

**Trade-off:** Multi-file fixes and project-wide transformations are outside
the current interface.

## ADR-003: Execute candidate code in Docker

**Decision:** Copy the candidate into a disposable case workspace inside a
non-root, network-disabled, resource-limited container with read-only root
filesystem.

**Reason:** The proposed source and its runtime behaviour are untrusted.

**Trade-off:** Docker is a required runtime dependency for verification,
shares the host kernel, and is not a formally verified sandbox.

## ADR-004: Require baseline reproduction and independent checks

**Decision:** Check that the original case reproduces first, then run visible
security, regression, holdout, and behaviour stages separately.

**Reason:** A passing security test can be achieved by a narrow blacklist or
by disabling the endpoint; independent tests help detect those false
successes.

**Trade-off:** Finite hand-authored tests cannot prove correctness for all
inputs.

## ADR-005: Hide holdouts from prompts, not from public repository readers

**Decision:** The prompt builder reads vulnerable source, case metadata, and
visible tests only. Holdout tests and known patches are excluded.

**Reason:** This allows repeatable independent checks without leaking their
contents directly to the model call.

**Trade-off:** The repository is public, so holdouts are not secret from
humans or any model with repository access. This is disclosed in the
methodology.

## ADR-006: Provider abstraction with deterministic mock by default

**Decision:** Use a provider interface, a local deterministic mock provider,
and an opt-in Anthropic Messages API provider selected by CLI arguments.

**Reason:** Tests, CI, and benchmark wiring can run without credentials;
manual runs can exercise a real provider.

**Trade-off:** Canned mock outcomes test verifier paths, not model quality.
Anthropic runs need a secret and depend on an external service.

## ADR-007: Store evidence locally as JSON and Markdown

**Decision:** Write structured machine-readable evidence and a readable
Markdown rendering under ignored `results/`.

**Reason:** Users can inspect and archive the patch hash, source hashes,
prompt, stage outputs, verdict, and reasoning without external services.

**Trade-off:** Local evidence is not signed or tamper-proof; users must retain
the relevant source revision and runtime context for meaningful comparison.

## ADR-008: Pin dependencies and separate live benchmarks

**Decision:** Pin npm dependencies and use the deterministic mock benchmark in
regular CI. Run Anthropic benchmarks only through a manually triggered
workflow.

**Reason:** CI should not need secrets or incur API cost, while live-model
experiments remain explicit.

**Trade-off:** Mock CI does not validate remote API availability or model
quality; manual results may drift as the remote service changes.
