import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon?: LucideIcon;
  badge?: number | string;
  badgeColor?: 'blue' | 'amber' | 'emerald' | 'rose';
  subtitle?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  badge,
  badgeColor = 'blue',
  subtitle
}: StatCardProps) {
  const badgeClasses = {
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    rose: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  }[badgeColor];

  return (
    <div className="p-5 rounded-2xl bg-[#131e30] border border-slate-800/80 hover:border-slate-700/80 transition-all duration-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-400">{title}</span>
        {Icon && (
          <div className="p-2 rounded-xl bg-slate-800/60 text-slate-300">
            <Icon className="w-4 h-4" />
          </div>
        )}
        {badge !== undefined && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${badgeClasses}`}>
            {badge}
          </span>
        )}
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-3xl font-bold tracking-tight text-white">{value}</span>
        {subtitle && (
          <span className="text-xs text-slate-500 font-medium">{subtitle}</span>
        )}
      </div>
    </div>
  );
}
