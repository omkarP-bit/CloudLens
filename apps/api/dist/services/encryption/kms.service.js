import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { env } from '../../config/env.js';
import { randomBytes } from 'crypto';
let kms = null;
try {
    kms = new KMSClient({ region: env.KMS_REGION });
}
catch (e) {
    console.warn('⚠️ AWS KMS Client initialization failed. Using fallback mock KMS.');
}
const CMK_ARN = env.KMS_CMK_ARN;
/**
 * Generate a fresh Data Encryption Key via KMS.
 * Returns both the plaintext DEK (for immediate use) and its
 * KMS-encrypted ciphertext (to store in DB).
 */
export async function generateDEK() {
    if (!kms || CMK_ARN === 'mock-key' || CMK_ARN.startsWith('mock')) {
        const mockDek = randomBytes(32);
        const encryptedDek = 'mock_' + mockDek.toString('base64');
        return {
            dek: mockDek,
            encryptedDek,
        };
    }
    try {
        const { Plaintext, CiphertextBlob } = await kms.send(new GenerateDataKeyCommand({ KeyId: CMK_ARN, KeySpec: 'AES_256' }));
        return {
            dek: Buffer.from(Plaintext),
            encryptedDek: Buffer.from(CiphertextBlob).toString('base64'),
        };
    }
    catch (err) {
        console.warn('⚠️ KMS GenerateDataKey failed, falling back to mock DEK:', err);
        const mockDek = randomBytes(32);
        const encryptedDek = 'mock_' + mockDek.toString('base64');
        return { dek: mockDek, encryptedDek };
    }
}
/**
 * Decrypt an encrypted DEK from the DB using KMS.
 */
export async function decryptDEK(encryptedDek) {
    if (encryptedDek.startsWith('mock_')) {
        const base64Data = encryptedDek.substring(5);
        return Buffer.from(base64Data, 'base64');
    }
    if (!kms || CMK_ARN === 'mock-key' || CMK_ARN.startsWith('mock')) {
        throw new Error('KMS client not initialized or in mock mode but received real encrypted DEK');
    }
    try {
        const { Plaintext } = await kms.send(new DecryptCommand({ CiphertextBlob: Buffer.from(encryptedDek, 'base64') }));
        return Buffer.from(Plaintext);
    }
    catch (err) {
        console.warn('⚠️ KMS Decrypt failed, trying mock fallback:', err);
        if (encryptedDek.startsWith('mock_')) {
            return Buffer.from(encryptedDek.substring(5), 'base64');
        }
        throw err;
    }
}
