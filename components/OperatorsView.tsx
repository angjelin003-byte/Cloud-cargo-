'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import type { ActiveSession, Operator, OperatorRole } from '@/lib/types';

interface OperatorsViewProps {
  operators: Operator[];
  activeOperator: Operator | null;
  activeSessions: ActiveSession[];
  onSwitchOperator: (operatorId: string) => void;
  onCreateOperator: (input: {
    name: string;
    badgeCode: string;
    role: OperatorRole;
  }) => Promise<{ ok: boolean; error?: string }>;
  onUpdateRole: (operatorId: string, role: OperatorRole) => Promise<void>;
}

const ROLES: OperatorRole[] = ['Admin', 'Supervisor', 'Operator'];

export function OperatorsView({
  operators,
  activeOperator,
  activeSessions,
  onSwitchOperator,
  onCreateOperator,
  onUpdateRole,
}: OperatorsViewProps) {
  const [name, setName] = useState('');
  const [badgeCode, setBadgeCode] = useState('');
  const [role, setRole] = useState<OperatorRole>('Operator');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionsByOp = new Map<string, number>();
  for (const s of activeSessions) {
    sessionsByOp.set(s.operatorId, (sessionsByOp.get(s.operatorId) ?? 0) + 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await onCreateOperator({ name, badgeCode, role });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? 'Failed to add operator.');
      return;
    }
    setName('');
    setBadgeCode('');
    setRole('Operator');
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-slate-900">Warehouse Operators</h1>
        <p className="text-xs text-slate-500">
          Switch active operator identity or register personnel for multi-user stock attribution.
        </p>
      </div>

      {/* Compact Add Operator Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label htmlFor="op-name" className="block text-xs font-medium text-slate-700 mb-1">
              Full Name
            </label>
            <input
              id="op-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jordan Hayes"
              className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label htmlFor="op-badge" className="block text-xs font-medium text-slate-700 mb-1">
              Badge Code
            </label>
            <input
              id="op-badge"
              type="text"
              required
              value={badgeCode}
              onChange={(e) => setBadgeCode(e.target.value.toUpperCase())}
              placeholder="e.g. OP-125"
              className="w-full h-9 px-2.5 text-xs font-mono uppercase bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label htmlFor="op-role" className="block text-xs font-medium text-slate-700 mb-1">
              Role
            </label>
            <select
              id="op-role"
              value={role}
              onChange={(e) => setRole(e.target.value as OperatorRole)}
              className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="h-9 px-3.5 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
            {submitting ? 'Adding...' : 'Add Operator'}
          </button>
        </div>

        {error && (
          <p role="alert" className="text-xs font-medium text-red-700">
            {error}
          </p>
        )}
      </form>

      {/* Operators Directory Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                <th className="py-2 px-3 whitespace-nowrap">Badge</th>
                <th className="py-2 px-3 whitespace-nowrap">Operator</th>
                <th className="py-2 px-3 whitespace-nowrap">Role</th>
                <th className="py-2 px-3 whitespace-nowrap">Live Presence</th>
                <th className="py-2 px-3 whitespace-nowrap text-right">Session</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {operators.map((op) => {
                const isCurrent = activeOperator?.id === op.id;
                const liveCount = sessionsByOp.get(op.id) ?? 0;

                return (
                  <tr key={op.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono font-semibold text-slate-900">
                      {op.badgeCode}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-900">
                      {op.name}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <label htmlFor={`role-${op.id}`} className="sr-only">
                        Role for {op.name}
                      </label>
                      <select
                        id={`role-${op.id}`}
                        value={op.role}
                        onChange={(e) => onUpdateRole(op.id, e.target.value as OperatorRole)}
                        className="h-7 px-2 text-xs bg-white border border-slate-200 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {liveCount > 0 ? (
                        <span className="font-medium text-emerald-700 font-mono tabular-nums">
                          Online · {liveCount} {liveCount === 1 ? 'tab' : 'tabs'}
                        </span>
                      ) : (
                        <span className="text-slate-400">Standby</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-right">
                      {isCurrent ? (
                        <span className="text-xs font-semibold text-blue-700">
                          Current Session
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSwitchOperator(op.id)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                        >
                          Switch to {op.name.split(' ')[0]}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
