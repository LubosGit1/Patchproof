import { runBenchmark } from './benchmark.js';

const result = await runBenchmark({
  projectRoot: process.cwd(),
  providerName: 'mock',
  attemptsPerCase: 5,
});

if (result.evidence.verdicts.FALSE_SUCCESS.count < 1
  || result.evidence.naive.falseAccepts < 1
) {
  throw new Error(
    `Mock benchmark did not demonstrate a caught false success. Report: ${result.jsonPath}`,
  );
}

console.log(JSON.stringify({
  benchmark: result.jsonPath,
  report: result.markdownPath,
  falseSuccessesCaught: result.evidence.verdicts.FALSE_SUCCESS.count,
  naiveFalseAccepts: result.evidence.naive.falseAccepts,
  verifiedFixes: result.evidence.naive.patchProofVerified,
}, null, 2));
