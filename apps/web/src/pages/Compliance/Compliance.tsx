import { useState } from 'react';
import {
  ShieldCheck, Plus, Trash2, Loader, ToggleLeft, ToggleRight,
  AlertTriangle, CheckCircle, AlertCircle, HelpCircle, FileText,
  Eye, Pencil,
} from 'lucide-react';
import { useAccountStore } from '../../store/accountStore.js';
import {
  useCompliancePolicies,
  useCreateCompliancePolicy,
  useUpdateCompliancePolicy,
  useDeleteCompliancePolicy,
  useComplianceFindings,
  useComplianceStats,
  type CompliancePolicy,
} from '../../hooks/useCompliance.js';

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'text-red-400 bg-red-500/10';
    case 'high': return 'text-orange-400 bg-orange-500/10';
    case 'medium': return 'text-yellow-400 bg-yellow-500/10';
    case 'low': return 'text-blue-400 bg-blue-500/10';
    default: return 'text-zinc-400 bg-zinc-500/10';
  }
}

function getActionColor(action: string): string {
  switch (action) {
    case 'DENY': return 'text-red-400 bg-red-500/10';
    case 'WARN': return 'text-yellow-400 bg-yellow-500/10';
    case 'ALLOW': return 'text-green-400 bg-green-500/10';
    default: return 'text-zinc-400 bg-zinc-500/10';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'PASS': return <CheckCircle className="h-4 w-4 text-success" />;
    case 'FAIL': return <AlertCircle className="h-4 w-4 text-destructive" />;
    case 'WARN': return <AlertTriangle className="h-4 w-4 text-warning" />;
    default: return <HelpCircle className="h-4 w-4 text-zinc-500" />;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const RULE_TEMPLATES = [
  {
    name: 'Block Terminations in Production',
    description: 'Prevent EC2/RDS termination actions in production regions',
    template: {
      conditions: {
        all: [
          { field: 'action', operator: 'in', value: ['TERMINATE', 'DELETE'] },
          { field: 'region', operator: 'not_in', value: ['us-east-1', 'us-west-2'] },
        ],
      },
    },
    action: 'DENY' as const,
    severity: 'critical' as const,
    framework: 'custom',
  },
  {
    name: 'Restrict Stop Actions on Weekends',
    description: 'Warn when stopping instances during business hours on weekdays',
    template: {
      conditions: {
        all: [
          { field: 'action', operator: 'equals', value: 'STOP' },
          { field: 'dayOfWeek', operator: 'in', value: [1, 2, 3, 4, 5] },
          { field: 'time', operator: 'greater_than', value: 8 },
          { field: 'time', operator: 'less_than', value: 18 },
        ],
      },
    },
    action: 'WARN' as const,
    severity: 'medium' as const,
    framework: 'custom',
  },
  {
    name: 'Allow Only US Regions for EC2',
    description: 'Only allow EC2 actions in approved US regions',
    template: {
      conditions: {
        all: [
          { field: 'resourceType', operator: 'equals', value: 'EC2' },
          { field: 'region', operator: 'in', value: ['us-east-1', 'us-west-2', 'us-east-2', 'us-west-1'] },
        ],
      },
    },
    action: 'ALLOW' as const,
    severity: 'low' as const,
    framework: 'custom',
  },
];

export function Compliance() {
  const { activeAccountId } = useAccountStore();
  const { data: policies, isLoading: policiesLoading } = useCompliancePolicies(activeAccountId);
  const { data: stats, isLoading: statsLoading } = useComplianceStats(activeAccountId);
  const { data: findingsData, isLoading: findingsLoading } = useComplianceFindings(activeAccountId, { limit: 20 });

  const createPolicy = useCreateCompliancePolicy();
  const updatePolicy = useUpdateCompliancePolicy();
  const deletePolicy = useDeleteCompliancePolicy();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFindings, setShowFindings] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<CompliancePolicy | null>(null);

  const handleToggle = async (policy: CompliancePolicy) => {
    try {
      await updatePolicy.mutateAsync({ id: policy.id, data: { enabled: !policy.enabled } });
    } catch (err: any) {
      alert(err.message || 'Failed to toggle policy');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this policy? This action cannot be undone.')) return;
    try {
      await deletePolicy.mutateAsync(id);
    } catch (err: any) {
      alert(err.message || 'Failed to delete policy');
    }
  };

  if (!activeAccountId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Compliance & Policy Auditing</h1>
            <p className="text-zinc-500 text-xs mt-1">Define and manage governance policies to control resource actions across your accounts.</p>
          </div>
        </div>
        <div className="glass-panel p-12 rounded-xl flex flex-col items-center justify-center text-center gap-3">
          <ShieldCheck className="h-8 w-8 text-zinc-600" />
          <h3 className="text-sm font-semibold text-white">No Account Selected</h3>
          <p className="text-zinc-500 text-xs">Select an AWS account to view and manage compliance policies.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Compliance & Policy Auditing</h1>
          <p className="text-zinc-500 text-xs mt-1">Define and manage governance policies to control resource actions across your accounts.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFindings(!showFindings)}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-border text-zinc-400 hover:text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            <Eye className="h-4 w-4" />
            <span>{showFindings ? 'Show Policies' : 'View Findings'}</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-accent transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create Policy</span>
          </button>
        </div>
      </div>

      {!showFindings ? (
        <>
          {!statsLoading && stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatsCard
                icon={<FileText className="h-4 w-4 text-primary" />}
                label="Policies"
                value={stats.totalPolicies}
                sub={`${stats.enabledPolicies} enabled`}
              />
              <StatsCard
                icon={<CheckCircle className="h-4 w-4 text-success" />}
                label="Passed"
                value={stats.passCount}
                sub="Compliance checks"
              />
              <StatsCard
                icon={<AlertCircle className="h-4 w-4 text-destructive" />}
                label="Failed"
                value={stats.failCount}
                sub="Non-compliant resources"
              />
              <StatsCard
                icon={<AlertTriangle className="h-4 w-4 text-warning" />}
                label="Warnings"
                value={stats.warnCount}
                sub="Requires attention"
              />
            </div>
          )}

          <div className="glass-panel rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Compliance Policies</h2>
              <span className="text-[10px] text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded">
                {policies?.length || 0} policies
              </span>
            </div>

            {policiesLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader className="h-8 w-8 text-primary animate-spin" />
              </div>
            ) : !policies || policies.length === 0 ? (
              <div className="p-12 flex flex-col items-center justify-center text-center gap-3">
                <ShieldCheck className="h-8 w-8 text-zinc-600" />
                <h3 className="text-sm font-semibold text-white">No Policies Defined</h3>
                <p className="text-zinc-500 text-xs max-w-sm">
                  Create your first compliance policy to govern resource actions. Policies are evaluated in order — the first match determines the action.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-zinc-500">
                      <th className="text-left px-4 py-3 font-semibold">Name</th>
                      <th className="text-left px-4 py-3 font-semibold">Action</th>
                      <th className="text-left px-4 py-3 font-semibold">Severity</th>
                      <th className="text-left px-4 py-3 font-semibold">Framework</th>
                      <th className="text-left px-4 py-3 font-semibold">Scope</th>
                      <th className="text-left px-4 py-3 font-semibold">Created</th>
                      <th className="text-center px-4 py-3 font-semibold">Enabled</th>
                      <th className="text-right px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {policies.map((policy) => (
                      <tr key={policy.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <span className="text-white font-medium">{policy.name}</span>
                            {policy.description && (
                              <p className="text-zinc-500 mt-0.5 truncate max-w-[200px]">{policy.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${getActionColor(policy.action)}`}>
                            {policy.action}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${getSeverityColor(policy.severity)}`}>
                            {policy.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-zinc-400 capitalize">{policy.framework || 'custom'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-zinc-400">{policy.account_id ? 'Specific' : 'All accounts'}</span>
                        </td>
                        <td className="px-4 py-3 text-zinc-500">{formatDate(policy.created_at)}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleToggle(policy)}
                            className="cursor-pointer"
                            title={policy.enabled ? 'Disable' : 'Enable'}
                          >
                            {policy.enabled ? (
                              <ToggleRight className="h-5 w-5 text-primary" />
                            ) : (
                              <ToggleLeft className="h-5 w-5 text-zinc-600" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setSelectedPolicy(selectedPolicy?.id === policy.id ? null : policy)}
                              className="p-1.5 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                              title="View policy details"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            {!policy.is_builtin && (
                              <button
                                onClick={() => handleDelete(policy.id)}
                                disabled={deletePolicy.isPending}
                                className="p-1.5 text-zinc-500 hover:text-destructive transition-colors cursor-pointer disabled:opacity-50"
                                title="Delete policy"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {selectedPolicy && (
            <div className="glass-panel rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white">{selectedPolicy.name}</h3>
                <button
                  onClick={() => setSelectedPolicy(null)}
                  className="text-zinc-500 hover:text-white text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
              {selectedPolicy.description && (
                <p className="text-xs text-zinc-400 mb-4">{selectedPolicy.description}</p>
              )}
              <div className="bg-zinc-950 rounded-lg p-4 overflow-x-auto">
                <pre className="text-[10px] text-zinc-300 font-mono whitespace-pre-wrap">
                  {JSON.stringify(selectedPolicy.rule_definition, null, 2)}
                </pre>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${getActionColor(selectedPolicy.action)}`}>
                  {selectedPolicy.action}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${getSeverityColor(selectedPolicy.severity)}`}>
                  {selectedPolicy.severity}
                </span>
                <span className="text-[10px] text-zinc-500">
                  Created {formatDate(selectedPolicy.created_at)}
                </span>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Compliance Findings</h2>
            <span className="text-[10px] text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded">
              {findingsData?.total || 0} findings
            </span>
          </div>

          {findingsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader className="h-8 w-8 text-primary animate-spin" />
            </div>
          ) : !findingsData?.findings || findingsData.findings.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center gap-3">
              <ShieldCheck className="h-8 w-8 text-zinc-600" />
              <h3 className="text-sm font-semibold text-white">No Findings</h3>
              <p className="text-zinc-500 text-xs">No compliance scans have been run yet. Findings appear here when policies are evaluated during resource actions.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-zinc-500">
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                    <th className="text-left px-4 py-3 font-semibold">Resource</th>
                    <th className="text-left px-4 py-3 font-semibold">Type</th>
                    <th className="text-left px-4 py-3 font-semibold">Region</th>
                    <th className="text-left px-4 py-3 font-semibold">Detail</th>
                    <th className="text-left px-4 py-3 font-semibold">Scanned</th>
                  </tr>
                </thead>
                <tbody>
                  {findingsData.findings.map((finding) => (
                    <tr key={finding.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(finding.status)}
                          <span className={`font-semibold ${
                            finding.status === 'PASS' ? 'text-success' :
                            finding.status === 'FAIL' ? 'text-destructive' :
                            finding.status === 'WARN' ? 'text-warning' :
                            'text-zinc-500'
                          }`}>
                            {finding.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-white font-mono text-[10px]">{finding.resource_id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-zinc-400">{finding.resource_type}</span>
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{finding.region}</td>
                      <td className="px-4 py-3 text-zinc-500 max-w-[250px] truncate">{finding.detail || '-'}</td>
                      <td className="px-4 py-3 text-zinc-500">{formatDate(finding.scanned_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <CreatePolicyModal
          onClose={() => setShowCreateModal(false)}
          onCreate={async (data) => {
            try {
              await createPolicy.mutateAsync({
                ...data,
                accountId: activeAccountId,
              });
              setShowCreateModal(false);
            } catch (err: any) {
              alert(err.message || 'Failed to create policy');
            }
          }}
          isPending={createPolicy.isPending}
        />
      )}
    </div>
  );
}

function StatsCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub: string }) {
  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-xs text-zinc-500 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>
    </div>
  );
}

function CreatePolicyModal({
  onClose,
  onCreate,
  isPending,
}: {
  onClose: () => void;
  onCreate: (data: {
    name: string;
    description: string | null;
    framework: string | null;
    ruleDefinition: Record<string, unknown>;
    action: 'ALLOW' | 'DENY' | 'WARN';
    severity: string;
  }) => Promise<void>;
  isPending: boolean;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [framework, setFramework] = useState('custom');
  const [action, setAction] = useState<'ALLOW' | 'DENY' | 'WARN'>('DENY');
  const [severity, setSeverity] = useState('high');
  const [ruleJson, setRuleJson] = useState('');
  const [useTemplate, setUseTemplate] = useState('');
  const [jsonError, setJsonError] = useState('');

  const applyTemplate = (templateName: string) => {
    const tpl = RULE_TEMPLATES.find((t) => t.name === templateName);
    if (!tpl) return;
    setUseTemplate(templateName);
    setRuleJson(JSON.stringify(tpl.template, null, 2));
    setAction(tpl.action);
    setSeverity(tpl.severity);
    setFramework(tpl.framework);
    setName(tpl.name);
    setDescription(tpl.description);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJsonError('');

    let ruleDefinition: Record<string, unknown>;
    try {
      ruleDefinition = JSON.parse(ruleJson);
      if (!ruleDefinition.conditions) {
        setJsonError('Rule definition must have a "conditions" object');
        return;
      }
    } catch {
      setJsonError('Invalid JSON. Please check your syntax.');
      return;
    }

    await onCreate({
      name,
      description: description || null,
      framework: framework || null,
      ruleDefinition,
      action,
      severity,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[#121215] border border-border rounded-xl p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Create Compliance Policy</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white cursor-pointer">
            <span className="text-xs">✕</span>
          </button>
        </div>

        <div className="mb-6">
          <label className="block text-zinc-400 text-xs font-semibold mb-2">Quick-start Template</label>
          <div className="grid grid-cols-1 gap-2">
            {RULE_TEMPLATES.map((tpl) => (
              <button
                key={tpl.name}
                type="button"
                onClick={() => applyTemplate(tpl.name)}
                className={`text-left p-3 rounded-lg border text-xs transition-colors cursor-pointer ${
                  useTemplate === tpl.name
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-zinc-950 hover:border-zinc-700'
                }`}
              >
                <span className="text-white font-semibold">{tpl.name}</span>
                <p className="text-zinc-500 mt-0.5">{tpl.description}</p>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-400 text-xs font-semibold mb-1">Policy Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Block Production Terminations"
                className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-zinc-400 text-xs font-semibold mb-1">Framework</label>
              <select
                value={framework}
                onChange={(e) => setFramework(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none"
              >
                <option value="custom">Custom</option>
                <option value="CIS">CIS</option>
                <option value="HIPAA">HIPAA</option>
                <option value="PCI-DSS">PCI-DSS</option>
                <option value="SOC2">SOC2</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-zinc-400 text-xs font-semibold mb-1">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this policy enforces"
              className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-400 text-xs font-semibold mb-1">Effect</label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value as any)}
                className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none"
              >
                <option value="ALLOW">Allow</option>
                <option value="DENY">Deny</option>
                <option value="WARN">Warn</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-400 text-xs font-semibold mb-1">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-zinc-400 text-xs font-semibold mb-1">Rule Definition (JSON)</label>
            <textarea
              required
              value={ruleJson}
              onChange={(e) => { setRuleJson(e.target.value); setJsonError(''); }}
              rows={10}
              placeholder='{"conditions":{"all":[{"field":"action","operator":"in","value":["TERMINATE"]},{"field":"region","operator":"not_in","value":["us-east-1"]}]}}'
              className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary font-mono resize-vertical"
            />
            {jsonError && <p className="text-[10px] text-destructive mt-1">{jsonError}</p>}
            <p className="text-[10px] text-zinc-500 mt-1">
              Supported fields: action, resourceType, resourceId, region, time, dayOfWeek. Operators: equals, not_equals, in, not_in, contains, starts_with, ends_with, greater_than, less_than.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-900 border border-border text-zinc-400 hover:text-white rounded-lg text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-accent transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isPending && <Loader className="h-3 w-3 animate-spin" />}
              <span>Create Policy</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
