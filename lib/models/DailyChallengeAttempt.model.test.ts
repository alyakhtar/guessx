import { describe, expect, it } from 'vitest';

import { DailyChallengeAttemptSchema } from './DailyChallengeAttempt.model';

describe('DailyChallengeAttempt indexes', () => {
  it('enforces one durable attempt per account and UTC day', () => {
    expect(DailyChallengeAttemptSchema.indexes()).toContainEqual([
      { challengeDate: 1, userId: 1 },
      expect.objectContaining({
        unique: true,
        name: 'daily_attempt_per_account',
        partialFilterExpression: { userId: { $exists: true } },
      }),
    ]);
  });
});
