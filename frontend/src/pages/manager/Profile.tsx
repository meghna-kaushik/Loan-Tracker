import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function ManagerProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="p-4 md:p-6 max-w-md mx-auto mt-4">
      <h1 className="text-xl font-bold text-gray-900 mb-5">Profile</h1>

      <div className="card">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center">
            <span className="text-brand-700 font-bold text-xl">
              {user?.name?.charAt(0)?.toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-lg">{user?.name}</h2>
            <p className="text-sm text-gray-500">Collection Manager</p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="bg-surface-1 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Name</p>
            <p className="font-medium text-gray-900">{user?.name}</p>
          </div>
          <div className="bg-surface-1 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Phone Number</p>
            <p className="font-medium text-gray-900 font-mono">{user?.phone}</p>
          </div>
          <div className="bg-surface-1 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Role</p>
            <p className="font-medium text-gray-900">Collection Manager</p>
          </div>
        </div>

        <button onClick={handleLogout} className="btn-danger w-full">
          Sign Out
        </button>
      </div>
    </div>
  );
}
