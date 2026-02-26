import { useState, useEffect, FormEvent } from 'react';
import { api } from '../../services/api';
import { Profile } from '../../types';
import { useAuth } from '../../hooks/useAuth';

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add user modal
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addRole, setAddRole] = useState('');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // Deactivate confirm
  const [deactivating, setDeactivating] = useState<string | null>(null);

  // Reset password modal
  const [resetUser, setResetUser] = useState<Profile | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data.users as Profile[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleAddUser = async (e: FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (!addName.trim() || !addPhone.trim() || !addPassword || !addRole) {
      setAddError('All fields are required');
      return;
    }
    setAddLoading(true);
    try {
      await api.createUser({ name: addName.trim(), phone: addPhone.trim(), password: addPassword, role: addRole });
      setShowAdd(false);
      setAddName(''); setAddPhone(''); setAddPassword(''); setAddRole('');
      await loadUsers();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await api.deactivateUser(id);
      setDeactivating(null);
      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to deactivate user');
    }
  };

  const openResetModal = (u: Profile) => {
    setResetUser(u);
    setResetPassword('');
    setResetConfirm('');
    setResetError('');
    setResetSuccess('');
    setShowResetPassword(false);
    // small delay so modal renders first
    setTimeout(() => {}, 0);
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    if (!resetPassword || resetPassword.length < 6) {
      setResetError('Password must be at least 6 characters');
      return;
    }
    if (resetPassword !== resetConfirm) {
      setResetError('Passwords do not match');
      return;
    }

    setResetLoading(true);
    try {
      await api.resetPassword(resetUser!.id, resetPassword);
      setResetSuccess(`Password reset successfully for ${resetUser!.name}`);
      setResetPassword('');
      setResetConfirm('');
      setTimeout(() => {
        setResetUser(null);
        setResetSuccess('');
      }, 2000);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setResetLoading(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-900">User Management</h1>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm">+ Add User</button>
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
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-3 bg-surface-1">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-3">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-surface-1 transition-colors">
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    {u.name}
                    {u.id === currentUser?.id && (
                      <span className="ml-2 text-xs text-brand-600 font-medium">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-600">{u.phone}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${u.role === 'collection_manager' ? 'bg-brand-100 text-brand-700' : 'bg-orange-100 text-orange-700'}`}>
                      {u.role === 'collection_manager' ? 'Manager' : 'Field Agent'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-3 justify-end">
                      {/* Reset Password button — for all users except self */}
                      {u.id !== currentUser?.id && (
                        <button
                          onClick={() => openResetModal(u)}
                          className="text-xs text-blue-600 font-semibold hover:underline"
                        >
                          Reset Password
                        </button>
                      )}

                      {/* Deactivate button */}
                      {u.is_active && u.id !== currentUser?.id && (
                        deactivating === u.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">Confirm?</span>
                            <button onClick={() => handleDeactivate(u.id)}
                              className="text-xs bg-red-600 text-white px-2.5 py-1 rounded-lg font-semibold">
                              Yes
                            </button>
                            <button onClick={() => setDeactivating(null)}
                              className="text-xs bg-gray-200 text-gray-700 px-2.5 py-1 rounded-lg font-semibold">
                              No
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setDeactivating(u.id)}
                            className="text-xs text-red-600 font-semibold hover:underline">
                            Deactivate
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="font-semibold">No users yet</p>
              <p className="text-sm mt-1">Click "Add User" to create the first user</p>
            </div>
          )}
        </div>
      )}

      {/* ---- ADD USER MODAL ---- */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-surface-3">
              <h2 className="font-bold text-gray-900 text-lg">Add New User</h2>
              <button onClick={() => { setShowAdd(false); setAddError(''); }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleAddUser} className="p-5 space-y-4">
              <div>
                <label className="label" htmlFor="add-name">Full Name</label>
                <input id="add-name" type="text" className="input-field" placeholder="Enter full name"
                  value={addName} onChange={e => setAddName(e.target.value)} required />
              </div>
              <div>
                <label className="label" htmlFor="add-phone">Phone Number</label>
                <input id="add-phone" type="tel" className="input-field" placeholder="Enter phone number"
                  value={addPhone} onChange={e => setAddPhone(e.target.value)} required />
              </div>
              <div>
                <label className="label" htmlFor="add-password">Password</label>
                <input id="add-password" type="password" className="input-field" placeholder="Min 6 characters"
                  value={addPassword} onChange={e => setAddPassword(e.target.value)} required minLength={6} />
              </div>
              <div>
                <label className="label" htmlFor="add-role">Role</label>
                <select id="add-role" className="input-field" value={addRole}
                  onChange={e => setAddRole(e.target.value)} required>
                  <option value="">Select role...</option>
                  <option value="field_agent">Field Agent</option>
                  <option value="collection_manager">Collection Manager</option>
                </select>
              </div>
              {addError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-red-700 text-sm">{addError}</p>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button type="submit" className="btn-primary flex-1" disabled={addLoading}>
                  {addLoading ? 'Creating...' : 'Create User'}
                </button>
                <button type="button" onClick={() => { setShowAdd(false); setAddError(''); }}
                  className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---- RESET PASSWORD MODAL ---- */}
      {resetUser && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-surface-3">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">Reset Password</h2>
                <p className="text-sm text-gray-500 mt-0.5">For: <span className="font-semibold text-gray-700">{resetUser.name}</span> ({resetUser.phone})</p>
              </div>
              <button onClick={() => setResetUser(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <form onSubmit={handleResetPassword} className="p-5 space-y-4">
              {/* Success */}
              {resetSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-green-700 text-sm font-medium">{resetSuccess}</p>
                </div>
              )}

              <div>
                <label className="label" htmlFor="new-password">New Password</label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showResetPassword ? 'text' : 'password'}
                    className="input-field pr-10"
                    placeholder="Enter new password (min 6 chars)"
                    value={resetPassword}
                    onChange={e => setResetPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button type="button"
                    onClick={() => setShowResetPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showResetPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="label" htmlFor="confirm-password">Confirm New Password</label>
                <input
                  id="confirm-password"
                  type={showResetPassword ? 'text' : 'password'}
                  className="input-field"
                  placeholder="Re-enter new password"
                  value={resetConfirm}
                  onChange={e => setResetConfirm(e.target.value)}
                  required
                />
                {resetConfirm && resetPassword !== resetConfirm && (
                  <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
                )}
                {resetConfirm && resetPassword === resetConfirm && (
                  <p className="text-green-600 text-xs mt-1">✓ Passwords match</p>
                )}
              </div>

              {resetError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-red-700 text-sm">{resetError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="submit" className="btn-primary flex-1" disabled={resetLoading}>
                  {resetLoading ? 'Resetting...' : 'Reset Password'}
                </button>
                <button type="button" onClick={() => setResetUser(null)} className="btn-secondary flex-1">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
