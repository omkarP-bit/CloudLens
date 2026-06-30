import { supabaseAdmin } from '../../config/supabase.js';
import { generateDEK, decryptDEK } from '../encryption/kms.service.js';
import { encryptField, decryptField } from '../encryption/cipher.service.js';
import { env } from '../../config/env.js';
export async function saveAccount(userId, alias, awsAccountId, roleArn, credentialType, regions, creds) {
    const { dek, encryptedDek } = await generateDEK();
    const encAccessKey = encryptField(creds.accessKeyId, dek);
    const encSecretKey = encryptField(creds.secretAccessKey, dek);
    const encSessionToken = creds.sessionToken
        ? encryptField(creds.sessionToken, dek)
        : null;
    dek.fill(0);
    const { data, error } = await supabaseAdmin
        .from('aws_accounts')
        .insert({
        user_id: userId,
        alias,
        aws_account_id: awsAccountId,
        role_arn: roleArn,
        encrypted_access_key_id: JSON.stringify(encAccessKey),
        encrypted_secret_access_key: JSON.stringify(encSecretKey),
        encrypted_session_token: encSessionToken ? JSON.stringify(encSessionToken) : null,
        encryption_key_id: env.KMS_CMK_ARN,
        encrypted_dek: encryptedDek,
        credential_type: credentialType,
        regions,
        status: 'active',
    })
        .select()
        .single();
    if (error)
        throw error;
    return data;
}
export async function getDecryptedCredentials(accountId) {
    const { data, error } = await supabaseAdmin
        .from('aws_accounts')
        .select('encrypted_access_key_id, encrypted_secret_access_key, encrypted_session_token, encrypted_dek')
        .eq('id', accountId)
        .single();
    if (error || !data)
        throw new Error('Account not found');
    const dek = await decryptDEK(data.encrypted_dek);
    const accessKeyId = decryptField(JSON.parse(data.encrypted_access_key_id), dek);
    const secretAccessKey = decryptField(JSON.parse(data.encrypted_secret_access_key), dek);
    const sessionToken = data.encrypted_session_token
        ? decryptField(JSON.parse(data.encrypted_session_token), dek)
        : undefined;
    dek.fill(0);
    return { accessKeyId, secretAccessKey, sessionToken };
}
export async function listAccounts(userId) {
    const { data, error } = await supabaseAdmin
        .from('aws_accounts')
        .select('id, alias, aws_account_id, role_arn, credential_type, regions, status, last_validated_at, created_at, updated_at')
        .eq('user_id', userId);
    if (error)
        throw error;
    return data;
}
export async function deleteAccount(userId, accountId) {
    const { data, error } = await supabaseAdmin
        .from('aws_accounts')
        .delete()
        .eq('id', accountId)
        .eq('user_id', userId)
        .select()
        .single();
    if (error)
        throw error;
    return data;
}
export async function updateAccountStatus(accountId, status, validatedAt) {
    const { data, error } = await supabaseAdmin
        .from('aws_accounts')
        .update({ status, last_validated_at: validatedAt.toISOString() })
        .eq('id', accountId)
        .select()
        .single();
    if (error)
        throw error;
    return data;
}
export async function rotateCredentials(userId, accountId, creds) {
    const { dek, encryptedDek } = await generateDEK();
    const encAccessKey = encryptField(creds.accessKeyId, dek);
    const encSecretKey = encryptField(creds.secretAccessKey, dek);
    const encSessionToken = creds.sessionToken
        ? encryptField(creds.sessionToken, dek)
        : null;
    dek.fill(0);
    const { data, error } = await supabaseAdmin
        .from('aws_accounts')
        .update({
        encrypted_access_key_id: JSON.stringify(encAccessKey),
        encrypted_secret_access_key: JSON.stringify(encSecretKey),
        encrypted_session_token: encSessionToken ? JSON.stringify(encSessionToken) : null,
        encryption_key_id: env.KMS_CMK_ARN,
        encrypted_dek: encryptedDek,
        status: 'active',
    })
        .eq('id', accountId)
        .eq('user_id', userId)
        .select()
        .single();
    if (error)
        throw error;
    return data;
}
