import { useState } from 'react';
import { useAWS, AWSAccount } from '../../hooks/useAWS.js';
import {
  Plus,
  RefreshCw,
  Trash2,
  Key,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Loader,
  Shield,
} from 'lucide-react';

export function Accounts() {
  const {
    accounts,
    isLoading,
    createAccount,
    isCreating,
    deleteAccount,
    isDeleting,
    validateAccount,
    rotateCredentials,
    isRotating,
  } = useAWS();

  // Form states
  const [alias, setAlias] = useState('');
  const [awsAccountId, setAwsAccountId] = useState('');
  const [roleArn, setRoleArn] = useState('');
  const [credentialType, setCredentialType] = useState('iam_user');
  const [regions, setRegions] = useState<string[]>(['us-east-1']);
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [sessionToken, setSessionToken] = useState('');

  // Action modals/states
  const [showAddForm, setShowAddForm] = useState(false);
  const [rotatingAccount, setRotatingAccount] = useState<AWSAccount | null>(null);
  const [rotateAccessKeyId, setRotateAccessKeyId] = useState('');
  const [rotateSecretAccessKey, setRotateSecretAccessKey] = useState('');
  const [rotateSessionToken, setRotateSessionToken] = useState('');
  const [deletingAccount, setDeletingAccount] = useState<AWSAccount | null>(null);
  const [validatingAccountId, setValidatingAccountId] = useState<string | null>(null);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createAccount({
        alias,
        awsAccountId,
        roleArn,
        credentialType,
        regions,
        accessKeyId,
        secretAccessKey,
        sessionToken: sessionToken || undefined,
      });
      setAlias('');
      setAwsAccountId('');
      setRoleArn('');
      setAccessKeyId('');
      setSecretAccessKey('');
      setSessionToken('');
      setShowAddForm(false);
    } catch (err: any) {
      alert(err.message || 'Failed to add account');
    }
  };

  const handleRotateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rotatingAccount) return;
    try {
      await rotateCredentials({
        accountId: rotatingAccount.id,
        creds: {
          accessKeyId: rotateAccessKeyId,
          secretAccessKey: rotateSecretAccessKey,
          sessionToken: rotateSessionToken || undefined,
        },
      });
      setRotateAccessKeyId('');
      setRotateSecretAccessKey('');
      setRotateSessionToken('');
      setRotatingAccount(null);
    } catch (err: any) {
      alert(err.message || 'Failed to rotate credentials');
    }
  };

  const handleValidate = async (accountId: string) => {
    setValidatingAccountId(accountId);
    try {
      await validateAccount(accountId);
    } catch (err: any) {
      alert(err.message || 'Validation failed');
    } finally {
      setValidatingAccountId(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingAccount) return;
    try {
      await deleteAccount(deletingAccount.id);
      setDeletingAccount(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete account');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">AWS Account Connections</h1>
          <p className="text-zinc-500 text-xs mt-1">
            Securely link and manage credentials for your AWS control plane.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-accent transition-colors cursor-pointer shadow-lg shadow-primary/20"
        >
          <Plus className="h-4 w-4" />
          <span>Connect Account</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader className="h-8 w-8 text-primary animate-spin" />
          <span className="text-zinc-500 text-xs">Loading account connections...</span>
        </div>
      ) : accounts.length === 0 ? (
        <div className="glass-panel rounded-xl p-12 text-center max-w-2xl mx-auto flex flex-col items-center justify-center gap-4">
          <Shield className="h-12 w-12 text-zinc-600" />
          <h3 className="text-md font-semibold text-white">No Connected Accounts</h3>
          <p className="text-zinc-500 text-xs max-w-md">
            Connect an AWS Account to start aggregating costs, managing running services, and auditing security configurations.
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-accent transition-colors cursor-pointer mt-2"
          >
            <Plus className="h-4 w-4" />
            <span>Connect First Account</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {accounts.map((acc) => (
            <div key={acc.id} className="glass-panel rounded-xl p-6 relative flex flex-col justify-between hover:border-zinc-750 transition-all duration-200">
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-md font-bold text-white leading-tight">{acc.alias}</h3>
                    <p className="text-[11px] text-zinc-500 font-mono mt-1">ID: {acc.aws_account_id}</p>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                      acc.status === 'active'
                        ? 'bg-success/10 border-success/20 text-success'
                        : acc.status === 'invalid'
                        ? 'bg-destructive/10 border-destructive/20 text-destructive'
                        : 'bg-warning/10 border-warning/20 text-warning'
                    }`}
                  >
                    {acc.status === 'active' ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : acc.status === 'invalid' ? (
                      <XCircle className="h-3 w-3" />
                    ) : (
                      <Clock className="h-3 w-3 animate-pulse" />
                    )}
                    <span className="capitalize">{acc.status}</span>
                  </span>
                </div>

                <div className="space-y-2 text-xs border-t border-border/50 pt-4">
                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase font-bold tracking-wider">IAM Role ARN</span>
                    <span className="text-zinc-300 font-mono select-all truncate block">{acc.role_arn}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase font-bold tracking-wider">Credential Type</span>
                    <span className="text-zinc-300 capitalize">{acc.credential_type.replace(/_/g, ' ')}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase font-bold tracking-wider">Regions Scope</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {acc.regions.map((r) => (
                        <span key={r} className="bg-zinc-900 border border-border px-2 py-0.5 rounded text-[10px] text-zinc-400 font-mono">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                  {acc.last_validated_at && (
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 pt-2">
                      <AlertCircle className="h-3 w-3" />
                      <span>Last validated at {new Date(acc.last_validated_at).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border/50 pt-4 mt-6">
                <button
                  onClick={() => handleValidate(acc.id)}
                  disabled={validatingAccountId === acc.id}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {validatingAccountId === acc.id ? (
                    <Loader className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  <span>Validate</span>
                </button>

                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setRotatingAccount(acc)}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:text-accent transition-colors cursor-pointer"
                  >
                    <Key className="h-3.5 w-3.5" />
                    <span>Rotate Keys</span>
                  </button>

                  <button
                    onClick={() => setDeletingAccount(acc)}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Account Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#121215] border border-border rounded-xl p-6 max-h-[90vh] overflow-y-auto glow-primary animate-fade-in">
            <h2 className="text-lg font-bold text-white mb-4">Connect AWS Account</h2>
            <form onSubmit={handleAddAccount} className="space-y-4">
              <div>
                <label className="block text-zinc-400 text-xs font-semibold mb-1">Account Alias</label>
                <input
                  required
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="e.g. Production Billing"
                  className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1">AWS Account ID</label>
                  <input
                    required
                    maxLength={12}
                    minLength={12}
                    value={awsAccountId}
                    onChange={(e) => setAwsAccountId(e.target.value)}
                    placeholder="12-digit number"
                    className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1">Credential Type</label>
                  <select
                    value={credentialType}
                    onChange={(e) => setCredentialType(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none"
                  >
                    <option value="iam_user">IAM Access Key ID</option>
                    <option value="sts_assume_role">Assume IAM Role</option>
                    <option value="sts_session">STS Session Token</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 text-xs font-semibold mb-1">Role ARN</label>
                <input
                  required
                  value={roleArn}
                  onChange={(e) => setRoleArn(e.target.value)}
                  placeholder="arn:aws:iam::123456789012:role/FinOpsAdmin"
                  className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-zinc-400 text-xs font-semibold mb-1">Regions Scope (comma separated)</label>
                <input
                  required
                  value={regions.join(', ')}
                  onChange={(e) => setRegions(e.target.value.split(',').map((r) => r.trim()))}
                  placeholder="us-east-1, us-west-2, eu-west-1"
                  className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>

              <div className="relative my-4 select-none">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-[#121215] px-2 text-zinc-600 font-semibold tracking-wider">AWS Key Credentials</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1">Access Key ID</label>
                  <input
                    required
                    value={accessKeyId}
                    onChange={(e) => setAccessKeyId(e.target.value)}
                    placeholder="AKIA..."
                    className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1">Secret Access Key</label>
                  <input
                    required
                    type="password"
                    value={secretAccessKey}
                    onChange={(e) => setSecretAccessKey(e.target.value)}
                    placeholder="Secret Key"
                    className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {credentialType === 'sts_session' && (
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1">Session Token (optional)</label>
                  <textarea
                    value={sessionToken}
                    onChange={(e) => setSessionToken(e.target.value)}
                    placeholder="Token string..."
                    rows={2}
                    className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-zinc-900 border border-border text-zinc-400 hover:text-white rounded-lg text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-accent transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isCreating && <Loader className="h-3 w-3 animate-spin" />}
                  <span>Save Connection</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rotate Credentials Modal */}
      {rotatingAccount && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#121215] border border-border rounded-xl p-6 glow-primary animate-fade-in">
            <h2 className="text-lg font-bold text-white mb-2">Rotate Credentials</h2>
            <p className="text-zinc-500 text-xs mb-4">
              Rotate credential keys for <span className="font-semibold text-white">{rotatingAccount.alias}</span>. The account status will be set to pending until validation is rerun.
            </p>
            <form onSubmit={handleRotateCredentials} className="space-y-4">
              <div>
                <label className="block text-zinc-400 text-xs font-semibold mb-1">New Access Key ID</label>
                <input
                  required
                  value={rotateAccessKeyId}
                  onChange={(e) => setRotateAccessKeyId(e.target.value)}
                  placeholder="AKIA..."
                  className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-zinc-400 text-xs font-semibold mb-1">New Secret Access Key</label>
                <input
                  required
                  type="password"
                  value={rotateSecretAccessKey}
                  onChange={(e) => setRotateSecretAccessKey(e.target.value)}
                  placeholder="Secret Key"
                  className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {rotatingAccount.credential_type === 'sts_session' && (
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1">New Session Token</label>
                  <textarea
                    value={rotateSessionToken}
                    onChange={(e) => setRotateSessionToken(e.target.value)}
                    placeholder="Token string..."
                    rows={2}
                    className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setRotatingAccount(null)}
                  className="px-4 py-2 bg-zinc-900 border border-border text-zinc-400 hover:text-white rounded-lg text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRotating}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-accent transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isRotating && <Loader className="h-3 w-3 animate-spin" />}
                  <span>Rotate Credentials</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingAccount && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#121215] border border-border rounded-xl p-6 animate-fade-in">
            <h2 className="text-md font-bold text-white mb-2 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span>Remove AWS Connection?</span>
            </h2>
            <p className="text-zinc-500 text-xs mb-6">
              Are you sure you want to remove <span className="font-semibold text-white">{deletingAccount.alias}</span>? This action is irreversible. All cache and budget metrics will be cleaned up.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeletingAccount(null)}
                className="px-4 py-2 bg-zinc-900 border border-border text-zinc-400 hover:text-white rounded-lg text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-2 bg-destructive text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isDeleting && <Loader className="h-3 w-3 animate-spin" />}
                <span>Remove Account</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
