import { createHash, randomBytes } from 'node:crypto';
import { mkdir, realpath, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';

import { createProvider, DEFAULT_MODEL, DEFAULT_PARAMETERS } from './provider.js';
import { buildProviderPrompt } from './prompt.js';
import type { ProviderName, ProviderParameters, ProviderPrompt } from './types.js';

export interface ProposeOptions {
  projectRoot: string;
  caseId: string;
  providerName: ProviderName;
  attempt: number;
  model?: string;
  outputPath?: string;
}

export interface ProposalRecord {
  schemaVersion: 1;
  attemptId: string;
  createdAt: string;
  caseId: string;
  provider: ProviderName;
  model: string;
  parameters: ProviderParameters;
  scenario?: string;
  prompt: ProviderPrompt;
  promptSha256: string;
  vulnerableSourceSha256: string;
  patchSha256: string;
  patchBytes: number;
  patchFile: string;
}

export interface ProposeResult {
  record: ProposalRecord;
  patchPath: string;
  recordPath: string;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function runId(): string {
  return `${new Date().toISOString().replaceAll(/[-:.]/g, '')}-${randomBytes(4).toString('hex')}`;
}

export async function proposePatch(options: ProposeOptions): Promise<ProposeResult> {
  if (!Number.isSafeInteger(options.attempt) || options.attempt < 1) {
    throw new Error('Attempt number must be a positive integer');
  }

  const projectRoot = await realpath(options.projectRoot);
  const promptResult = await buildProviderPrompt(projectRoot, options.caseId);
  const requestedModel = options.model
    ?? process.env.ANTHROPIC_MODEL
    ?? DEFAULT_MODEL;
  const provider = await createProvider(
    options.providerName,
    projectRoot,
    options.caseId,
    options.attempt,
  );
  const response = await provider.generate({
    prompt: promptResult.prompt,
    model: requestedModel,
    parameters: DEFAULT_PARAMETERS,
  });

  const attemptId = runId();
  const outputDirectory = resolve(projectRoot, 'results/proposals', options.caseId, attemptId);
  await mkdir(outputDirectory, { recursive: true });
  if (await realpath(outputDirectory) !== outputDirectory) {
    throw new Error('Proposal output path must not traverse a symlink');
  }

  const defaultPatchPath = join(outputDirectory, 'candidate.diff');
  const patchPath = options.outputPath
    ? resolve(options.outputPath)
    : defaultPatchPath;
  const patchDirectory = resolve(patchPath, '..');
  await mkdir(patchDirectory, { recursive: true });
  const patchRelative = relative(projectRoot, patchPath);
  const recordPath = join(outputDirectory, 'proposal.json');
  const record: ProposalRecord = {
    schemaVersion: 1,
    attemptId,
    createdAt: new Date().toISOString(),
    caseId: options.caseId,
    provider: response.provider,
    model: response.model,
    parameters: response.parameters,
    ...(response.scenario ? { scenario: response.scenario } : {}),
    prompt: promptResult.prompt,
    promptSha256: sha256(JSON.stringify(promptResult.prompt)),
    vulnerableSourceSha256: promptResult.sourceSha256,
    patchSha256: sha256(response.text),
    patchBytes: Buffer.byteLength(response.text, 'utf8'),
    patchFile: patchRelative || basename(patchPath),
  };
  await writeFile(patchPath, response.text, { mode: 0o600 });
  await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });

  return { record, patchPath, recordPath };
}
