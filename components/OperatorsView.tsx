'use client';

import { memo, useMemo, useState } from 'react';
import { Check, Pencil, Trash2, UserPlus, X } from 'lucide-react';
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
  onUpdateOperator: (
    operatorId: string,
    updates: { name?: string; badgeCode?: string; role?: OperatorRole }
  ) => Promise<{ ok: boolean; error?: string }>;
  onDeleteOperator: (operatorId: string) => Promise<void>;
}

const ROLES: OperatorRole[] = ['Admin', 'Supervisor', 'Operator'];

export const OperatorsView = memo(function OperatorsView({
  operators,
  activeOperator,
  activeSessions,
  onSwitchOperator,
  onCreateOperator,
  onUpdateOperator,
  onDeleteOperator,
}: OperatorsViewProps) {
  const [name, setName] = useState('');
  const [badgeCode, setBadgeCode] = useState('');
  const [role, setRole] = useState<OperatorRole>('Operator');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBadge, setEditBadge] = useState('');
  const [editRole, setEditRole] = useState<OperatorRole>('Operator');
  const [editError, setEditError] = useState<string | null>(null);

  const sessionsByOp = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of activeSessions) {
      map.set(s.operatorId, (map.get(s.operatorId) ?? 0) + 1);
    }
    return map;
  }, [activeSessions]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await onCreateOperator({ name, badgeCode, role });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? 'Failed to add user account.');
      return;
    }
    setName('');
    setBadgeCode('');
    setRole('Operator');
  }

  function startEdit(op: Operator) {
    setEditingId(op.id);
    setEditName(op.name);
    setEditBadge(op.badgeCode);
    setEditRole(op.role);
    setEditError(null);
  }

  async function saveEdit(id: string) {
    setEditError(null);
    const res = await onUpdateOperator(id, {
      name: editName,
      badgeCode: editBadge,
      role: editRole,
    });
    if (!res.ok) {
      setEditError(res.error ?? 'Failed to update user account.');
      return;
    }
    setEditingId(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-slate-900">User Accounts & Operators</h1>
        <p className="text-xs text-slate-500">
          Create user accounts, edit profiles or roles, and switch accounts — all saved inventory and file changes sync across every connected account.
        </p>
      </div>

      {/* Compact Add User Form */}
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
              User / Badge Code
            </label>
            <input
              id="op-badge"
              type="text"
              required
              value={badgeCode}
              onChange={(e) => setBadgeCode(e.target.value.toUpperCase())}
              placeholder="e.g. OP-101"
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
            {submitting ? 'Adding...' : 'Add User'}
          </button>
        </div>

        {error && (
          <p role="alert" className="text-xs font-medium text-red-700">
            {error}
          </p>
        )}
      </form>

      {editError && (
        <p role="alert" className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {editError}
        </p>
      )}

      {/* Users Directory Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {operators.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <p className="text-sm font-semibold text-slate-900">No user accounts configured</p>
            <p className="mt-1 text-xs text-slate-500">
              Use the form above to add one or more user accounts.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-2 px-3 whitespace-nowrap">Badge</th>
                  <th className="py-2 px-3 whitespace-nowrap">User Name</th>
                  <th className="py-2 px-3 whitespace-nowrap">Role</th>
                  <th className="py-2 px-3 whitespace-nowrap">Live Presence</th>
                  <th className="py-2 px-3 whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {operators.map((op) => {
                  const isCurrent = activeOperator?.id === op.id;
                  const liveCount = sessionsByOp.get(op.id) ?? 0;
                  const isEditing = editingId === op.id;

                  return (
                    <tr key={op.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-semibold text-slate-900">
                        {isEditing ? (
                          <input
                            type="text"
                            aria-label={`Badge code for ${op.name}`}
                            value={editBadge}
                            onChange={(e) => setEditBadge(e.target.value.toUpperCase())}
                            className="w-24 h-7 px-2 text-xs font-mono uppercase bg-white border border-blue-400 rounded"
                          />
                        ) : (
                          op.badgeCode
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-900">
                        {isEditing ? (
                          <input
                            type="text"
                            aria-label={`Name for ${op.name}`}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-40 h-7 px-2 text-xs bg-white border border-blue-400 rounded"
                          />
                        ) : (
                          op.name
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <label htmlFor={`role-${op.id}`} className="sr-only">
                          Role for {op.name}
                        </label>
                        <select
                          id={`role-${op.id}`}
                          value={isEditing ? editRole : op.role}
                          onChange={(e) => {
                            const nextRole = e.target.value as OperatorRole;
                            if (isEditing) {
                              setEditRole(nextRole);
                            } else {
                              void onUpdateOperator(op.id, { role: nextRole });
                            }
                          }}
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
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => saveEdit(op.id)}
                                aria-label={`Save ${op.name}`}
                                className="px-2 py-1 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                aria-label={`Cancel editing ${op.name}`}
                                className="p-1 text-slate-500 hover:bg-slate-100 rounded cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              {isCurrent ? (
                                <span className="text-xs font-semibold text-blue-700 mr-1">
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
                              <button
                                type="button"
                                onClick={() => startEdit(op)}
                                aria-label={`Edit user ${op.name}`}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteOperator(op.id)}
                                aria-label={`Delete user ${op.name}`}
                                className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
});
