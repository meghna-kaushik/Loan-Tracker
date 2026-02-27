import { useState, FormEvent } from 'react';
import { api } from '../../services/api';
import { Visit } from '../../types';

const STATUS_COLORS: Record<string, string> = {
  'PTP': 'bg-blue-100 text-blue-700',
  'Not Found': 'bg-gray-100 text-gray-700',
  'Partial Received': 'bg-yellow-100 text-yellow-700',
  'Received': 'bg-green-100 text-green-700',
  'Others': 'bg-purple-100 text-purple-700',
};

export default function AllVisits() {
  const [loanSearch, setLoanSearch] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const loan = loanSearch.trim();
    const agent = agentSearch.trim();

    if (!loan && !agent) {
      setError('Enter at least one search term');
      return;
    }

    if (loan && !/^\d{21}$/.test(loan)) {
      setError('Loan ID must be exactly 21 digits');
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const data = await api.searchVisits({
        loan_number: loan || undefined,
        agent_query: agent || undefined,
      });
      setVisits(data.visits as Visit[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setLoanSearch('');
    setAgentSearch('');
    setVisits([]);
    setSearched(false);
    setError('');
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-5">All Visits</h1>

      {/* Search form */}
      <form onSubmit={handleSearch} className="card mb-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label" htmlFor="loan-search">Search by Loan ID</label>
            <input
              id="loan-search"
              type="text"
              inputMode="numeric"
              maxLength={21}
              className="input-field font-mono"
              placeholder="21-digit loan number"
              value={loanSearch}
              onChange={e => setLoanSearch(e.target.value.replace(/\D/g, ''))}
            />
            {loanSearch && <p className="text-xs text-gray-400 mt-1">{loanSearch.length}/21</p>}
          </div>

          <div>
            <label className="label" htmlFor="agent-search">Search by Agent Name or Phone</label>
            <input
              id="agent-search"
              type="text"
              className="input-field"
              placeholder="Agent name or phone number"
              value={agentSearch}
              onChange={e => setAgentSearch(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="error-msg mb-3">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
          {searched && (
            <button type="button" onClick={clearSearch} className="btn-secondary">
              Clear
            </button>
          )}
        </div>
      </form>

      {/* Results */}
      {loading && (
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent mx-auto mb-2" />
          <p className="text-sm text-gray-500">Searching visits...</p>
        </div>
      )}

      {!loading && searched && visits.length === 0 && (
        <div className="card text-center py-12 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="font-semibold">No visits found</p>
          <p className="text-sm mt-1">Try adjusting your search criteria</p>
        </div>
      )}

      {!loading && visits.length > 0 && (
        <div>
          <p className="text-sm text-gray-500 mb-3">{visits.length} visit{visits.length !== 1 ? 's' : ''} found</p>
          <div className="space-y-4">
            {visits.map(v => (
              <div key={v.id} className="card">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-mono text-xs text-gray-500 mb-1">{v.loan_number}</p>
                    <p className="font-bold text-gray-900">{v.person_visited}</p>
                    <p className="text-sm text-gray-600">
                      {v.agent_name} · <span className="font-mono">{v.agent_phone}</span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`badge ${STATUS_COLORS[v.status] || 'bg-gray-100 text-gray-700'}`}>
                      {v.status}
                    </span>
                    <p className="text-xs text-gray-400">{formatDate(v.visited_at)}</p>
                  </div>
                </div>

                <p className="text-sm text-gray-700 mb-3 bg-surface-1 rounded-lg px-3 py-2">{v.comments}</p>

                {/* PTP details */}
                {v.status === 'PTP' && v.ptp_date && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3 text-xs text-blue-800 flex gap-4">
                    <span>📅 PTP Date: <strong>{new Date(v.ptp_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></span>
                    <span>💰 Amount: <strong>₹{v.ptp_amount?.toLocaleString('en-IN')}</strong></span>
                  </div>
                )}

                <div className="flex items-start gap-1.5 text-xs text-gray-500 mb-3">
                  <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  <div>
                    <p>{v.address}</p>
                    <p className="font-mono text-gray-400">{v.latitude.toFixed(6)}, {v.longitude.toFixed(6)}</p>
                  </div>
                </div>

                {v.photo_urls?.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {v.photo_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt={`Photo ${i + 1}`}
                          className="w-20 h-20 object-cover rounded-xl border border-surface-3 hover:opacity-90 transition-opacity" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!searched && (
        <div className="card text-center py-12 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="font-semibold">Search for visits</p>
          <p className="text-sm mt-1">Use the search boxes above to find visit records</p>
        </div>
      )}
    </div>
  );
}
