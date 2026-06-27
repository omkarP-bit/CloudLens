import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/api.js';

export interface AWSAccount {
  id: string;
  alias: string;
  aws_account_id: string;
  role_arn: string;
  credential_type: 'iam_user' | 'sts_assume_role' | 'sts_session';
  regions: string[];
  status: 'pending' | 'active' | 'invalid' | 'expired';
  last_validated_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useAWS() {
  const queryClient = useQueryClient();

  const accountsQuery = useQuery<AWSAccount[]>({
    queryKey: ['aws-accounts'],
    queryFn: () => apiRequest<AWSAccount[]>('/api/accounts'),
  });

  const createAccountMutation = useMutation({
    mutationFn: (newAccount: {
      alias: string;
      awsAccountId: string;
      roleArn: string;
      credentialType: string;
      regions: string[];
      accessKeyId: string;
      secretAccessKey: string;
      sessionToken?: string;
    }) =>
      apiRequest<AWSAccount>('/api/accounts', {
        method: 'POST',
        body: JSON.stringify(newAccount),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aws-accounts'] });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: (accountId: string) =>
      apiRequest<AWSAccount>(`/api/accounts/${accountId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aws-accounts'] });
    },
  });

  const validateAccountMutation = useMutation({
    mutationFn: (accountId: string) =>
      apiRequest<{ success: boolean; account: AWSAccount }>(`/api/accounts/${accountId}/validate`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aws-accounts'] });
    },
  });

  const rotateCredentialsMutation = useMutation({
    mutationFn: ({
      accountId,
      creds,
    }: {
      accountId: string;
      creds: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
      };
    }) =>
      apiRequest<AWSAccount>(`/api/accounts/${accountId}/credentials`, {
        method: 'PATCH',
        body: JSON.stringify(creds),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aws-accounts'] });
    },
  });

  return {
    accounts: accountsQuery.data || [],
    isLoading: accountsQuery.isLoading,
    error: accountsQuery.error,
    createAccount: createAccountMutation.mutateAsync,
    isCreating: createAccountMutation.isPending,
    deleteAccount: deleteAccountMutation.mutateAsync,
    isDeleting: deleteAccountMutation.isPending,
    validateAccount: validateAccountMutation.mutateAsync,
    isValidating: validateAccountMutation.isPending,
    rotateCredentials: rotateCredentialsMutation.mutateAsync,
    isRotating: rotateCredentialsMutation.isPending,
  };
}
