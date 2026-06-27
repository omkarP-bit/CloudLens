import { Compass } from 'lucide-react';

interface PlaceholderProps {
  title: string;
  description: string;
}

export function Placeholder({ title, description }: PlaceholderProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
          <p className="text-zinc-500 text-xs mt-1">{description}</p>
        </div>
      </div>

      <div className="glass-panel p-16 rounded-xl flex flex-col items-center justify-center text-center gap-4">
        <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <Compass className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-white">Milestone Feature Coming Soon</h3>
        <p className="text-zinc-500 text-xs max-w-sm">
          This page is scheduled for implementation in a later phase of the CloudLens product blueprint.
        </p>
      </div>
    </div>
  );
}
