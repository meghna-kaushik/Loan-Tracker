import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { AuditLog } from '../../types';

const ACTION_LABELS: Record<string, string> = {
  USER_CREATED: 'User Created',
  USER_DEACTIVATED: 'User Deactivated',
  PASSWORD_RESET: 'Password Reset',
};

const ACTION_COLORS: Record<string, string> = {
  USER_CREATED: 'bg-green-100 text-green-700',
  USER_DEACTIVATED: 'bg-red-100 text-red-700',
  PASSWORD_RESET: 'bg-yellow-100 text-yellow-700',
};

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  const loadLogs = async (action?: string) => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs(action || undefined);
      setLogs(data.logs as AuditLog[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, []);

  const handleFilterChange = (val: string) => {
    setFilter(val);
    loadLogs(val || undefined);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-900">Audit Logs</h1>
        <select
          className="input-field w-auto text-sm"
          value={filter}
          onChange={e => handleFilterChange(e.target.value)}
        >
          <option value="">All Actions</option>
          <option value="USER_CREATED">User Created</option>
          <option value="USER_DEACTIVATED">User Deactivated</option>
          <option value="PASSWORD_RESET">Password Reset</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent mx-auto" />
        </div>
      ) : logs.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="font-semibold">No audit logs found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map(log => (
            <div key={log.id} className="card">
              <div className="flex items-start justify-between mb-2">
                <span className={`badge ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'}`}>
                  {ACTION_LABELS[log.action] || log.action}
                </span>
                <p className="text-xs text-gray-400 font-mono">{formatDate(log.created_at)}</p>
              </div>
              <div className="text-sm space-y-1">
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">By:</span> {log.performed_by_name}
                </p>
                {log.metadata && typeof log.metadata === 'object' && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2 mb-1">Details</p>
                    <div className="bg-surface-1 rounded-lg px-3 py-2 font-mono text-xs text-gray-600 overflow-x-auto">
                      {Object.entries(log.metadata).map(([k, v]) => (
                        <div key={k}><span className="text-gray-400">{k}:</span> {String(v)}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
