export const CASE_IDS = ['sql-injection', 'idor', 'path-traversal'] as const;

export type CaseId = (typeof CASE_IDS)[number];

export function isCaseId(value: string): value is CaseId {
  return CASE_IDS.some((caseId) => caseId === value);
}
