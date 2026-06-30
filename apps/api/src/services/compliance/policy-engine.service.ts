export interface PolicyResult {
  result: 'ALLOW' | 'DENY' | 'WARN';
  reason: string;
}

export async function evaluateAction(
  userId: string,
  accountId: string,
  resourceType: string,
  resourceId: string,
  action: string,
  region: string
): Promise<PolicyResult> {
  return { result: 'ALLOW', reason: 'Phase 5 stub — all actions allowed' };
}
