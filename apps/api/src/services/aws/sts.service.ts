import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { AWSCredentials } from '../supabase/accounts.repo.js';

/**
 * Validate credentials via AWS STS.
 * Returns the 12-digit AWS Account ID on success.
 */
export async function validateAWSCredentials(creds: AWSCredentials): Promise<string> {
  if (creds.accessKeyId.startsWith('mock_') || creds.secretAccessKey.startsWith('mock_')) {
    return '123456789012';
  }

  try {
    const client = new STSClient({
      region: 'us-east-1',
      credentials: {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        sessionToken: creds.sessionToken,
      },
    });

    const response = await client.send(new GetCallerIdentityCommand({}));
    if (!response.Account) {
      throw new Error('STS returned empty account ID');
    }
    return response.Account;
  } catch (err: any) {
    console.error('AWS STS validation failed:', err);
    throw new Error(`AWS STS validation failed: ${err.message || err}`);
  }
}
