import { useState } from 'react';
import {
  Server, Database, Container, Code, HardDrive, MemoryStick,
  Loader, Search, X, Layers,
} from 'lucide-react';
import { useAccountStore } from '../../store/accountStore.js';
import { useServices, type Resource, type ResourceType } from '../../hooks/useServices.js';

const TYPE_ICONS: Record<ResourceType, typeof Server> = {
  EC2: Server,
  RDS: Database,
  ECS: Container,
  Lambda: Code,
  S3: HardDrive,
  ElastiCache: MemoryStick,
};

const TYPE_COLORS: Record<ResourceType, string> = {
  EC2: 'text-orange-400',
  RDS: 'text-blue-400',
  ECS: 'text-emerald-400',
  Lambda: 'text-purple-400',
  S3: 'text-yellow-400',
  ElastiCache: 'text-cyan-400',
};

interface DetailDrawerProps {
  resource: Resource | null;
  onClose: () => void;
}

function DetailDrawer({ resource, onClose }: DetailDrawerProps) {
  if (!resource) return null;

  const Icon = TYPE_ICONS[resource.type];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="w-full max-w-lg bg-[#121215] border-l border-border h-full overflow-y-auto animate-fade-in">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Icon className={`h-5 w-5 ${TYPE_COLORS[resource.type]}`} />
              <h2 className="text-lg font-bold text-white">{resource.name}</h2>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-panel rounded-lg p-3">
                <span className="text-zinc-500 block text-[10px] uppercase font-bold mb-1">Type</span>
                <span className="text-white font-semibold">{resource.type}</span>
              </div>
              <div className="glass-panel rounded-lg p-3">
                <span className="text-zinc-500 block text-[10px] uppercase font-bold mb-1">Region</span>
                <span className="text-white font-semibold">{resource.region}</span>
              </div>
              <div className="glass-panel rounded-lg p-3">
                <span className="text-zinc-500 block text-[10px] uppercase font-bold mb-1">State</span>
                <span className={`font-semibold ${
                  resource.state === 'running' || resource.state === 'available' || resource.state === 'Active'
                    ? 'text-success' : 'text-zinc-400'
                }`}>{resource.state}</span>
              </div>
              <div className="glass-panel rounded-lg p-3">
                <span className="text-zinc-500 block text-[10px] uppercase font-bold mb-1">Cost/Month</span>
                <span className="text-white font-semibold">
                  {resource.estimatedMonthlyCost != null
                    ? `$${resource.estimatedMonthlyCost.toFixed(2)}`
                    : 'N/A'}
                </span>
              </div>
            </div>

            <div className="glass-panel rounded-lg p-3">
              <span className="text-zinc-500 block text-[10px] uppercase font-bold mb-1">Resource ID</span>
              <span className="text-zinc-300 font-mono text-[11px] break-all">{resource.id}</span>
            </div>

            {resource.launchTime && (
              <div className="glass-panel rounded-lg p-3">
                <span className="text-zinc-500 block text-[10px] uppercase font-bold mb-1">Launch Time</span>
                <span className="text-zinc-300">{new Date(resource.launchTime).toLocaleString()}</span>
              </div>
            )}

            <div className="glass-panel rounded-lg p-3">
              <span className="text-zinc-500 block text-[10px] uppercase font-bold mb-1">Metadata</span>
              <pre className="text-zinc-400 text-[10px] mt-1 overflow-x-auto max-h-40 scrollbar-thin">
                {JSON.stringify(resource.metadata, null, 2)}
              </pre>
            </div>

            {Object.keys(resource.tags).length > 0 && (
              <div className="glass-panel rounded-lg p-3">
                <span className="text-zinc-500 block text-[10px] uppercase font-bold mb-2">Tags</span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(resource.tags).map(([k, v]) => (
                    <span key={k} className="bg-zinc-900 border border-border px-2 py-0.5 rounded text-[10px] text-zinc-300">
                      {k}: {v}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 bg-black/40 backdrop-blur-sm cursor-pointer" onClick={onClose} />
    </div>
  );
}

export function Services() {
  const { activeAccountId } = useAccountStore();
  const [filterType, setFilterType] = useState<string>('');
  const [filterRegion, setFilterRegion] = useState<string>('');
  const [filterState, setFilterState] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  const { data, isLoading } = useServices({
    accountId: activeAccountId,
    type: filterType as ResourceType | undefined,
    region: filterRegion || undefined,
    state: filterState || undefined,
  });

  const resources = data?.resources || [];
  const filteredResources = resources.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
  });

  const uniqueRegions = [...new Set(resources.map((r) => r.region))].sort();

  if (!activeAccountId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Services Inventory</h1>
            <p className="text-zinc-500 text-xs mt-1">Live tracking and configuration audits for all active AWS resources across regions.</p>
          </div>
        </div>
        <div className="glass-panel p-12 rounded-xl flex flex-col items-center justify-center text-center gap-3">
          <Server className="h-8 w-8 text-zinc-600" />
          <h3 className="text-sm font-semibold text-white">No Account Selected</h3>
          <p className="text-zinc-500 text-xs">Connect and select an AWS account to view your resources.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Services Inventory</h1>
          <p className="text-zinc-500 text-xs mt-1">Live tracking and configuration audits for all active AWS resources across regions.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ID..."
            className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-zinc-950 border border-border text-white text-xs rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All Types</option>
          <option value="EC2">EC2</option>
          <option value="RDS">RDS</option>
          <option value="ECS">ECS</option>
          <option value="Lambda">Lambda</option>
          <option value="S3">S3</option>
          <option value="ElastiCache">ElastiCache</option>
        </select>

        <select
          value={filterRegion}
          onChange={(e) => setFilterRegion(e.target.value)}
          className="bg-zinc-950 border border-border text-white text-xs rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All Regions</option>
          {uniqueRegions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <select
          value={filterState}
          onChange={(e) => setFilterState(e.target.value)}
          className="bg-zinc-950 border border-border text-white text-xs rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All States</option>
          <option value="running">Running</option>
          <option value="stopped">Stopped</option>
          <option value="available">Available</option>
          <option value="terminated">Terminated</option>
        </select>

        <span className="text-xs text-zinc-500 ml-auto">
          {data ? `${filteredResources.length} / ${data.total} resources` : ''}
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader className="h-8 w-8 text-primary animate-spin" />
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="glass-panel p-12 rounded-xl flex flex-col items-center justify-center text-center gap-3">
          <Layers className="h-8 w-8 text-zinc-600" />
          <h3 className="text-sm font-semibold text-white">No Resources Found</h3>
          <p className="text-zinc-500 text-xs max-w-sm">
            {resources.length === 0
              ? 'No resources were discovered. Verify your AWS credentials have the required read permissions.'
              : 'No resources match your current filters.'}
          </p>
        </div>
      ) : (
        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-zinc-500">
                  <th className="text-left font-semibold p-3 pl-4">Type</th>
                  <th className="text-left font-semibold p-3">Name</th>
                  <th className="text-left font-semibold p-3">Resource ID</th>
                  <th className="text-left font-semibold p-3">Region</th>
                  <th className="text-left font-semibold p-3">State</th>
                  <th className="text-right font-semibold p-3">Est. Cost</th>
                  <th className="text-right font-semibold p-3 pr-4">Launch Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredResources.map((r) => {
                  const Icon = TYPE_ICONS[r.type];
                  return (
                    <tr
                      key={`${r.type}-${r.id}`}
                      onClick={() => setSelectedResource(r)}
                      className="border-b border-border/50 last:border-0 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                      <td className="p-3 pl-4">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${TYPE_COLORS[r.type]}`} />
                          <span className="text-zinc-400 font-medium">{r.type}</span>
                        </div>
                      </td>
                      <td className="p-3 text-white font-medium">{r.name}</td>
                      <td className="p-3 text-zinc-500 font-mono text-[10px] max-w-[180px] truncate">{r.id}</td>
                      <td className="p-3 text-zinc-300">{r.region}</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          r.state === 'running' || r.state === 'available' || r.state === 'Active'
                            ? 'bg-success/10 border-success/20 text-success'
                            : r.state === 'stopped' || r.state === 'inactive'
                            ? 'bg-warning/10 border-warning/20 text-warning'
                            : 'bg-zinc-900 border-border text-zinc-400'
                        }`}>
                          {r.state}
                        </span>
                      </td>
                      <td className="p-3 text-right text-zinc-300">
                        {r.estimatedMonthlyCost != null ? `$${r.estimatedMonthlyCost.toFixed(0)}` : '-'}
                      </td>
                      <td className="p-3 pr-4 text-right text-zinc-500 text-[10px]">
                        {r.launchTime ? new Date(r.launchTime).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DetailDrawer resource={selectedResource} onClose={() => setSelectedResource(null)} />
    </div>
  );
}
