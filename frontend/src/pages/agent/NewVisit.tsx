import { useState, useRef, useEffect, ChangeEvent, FormEvent } from 'react';
import { Visit, VISIT_STATUSES } from '../../types';
import { api, uploadPhotos, reverseGeocode } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

type Step = 'loan-entry' | 'visit-form';

// Detect mobile device
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

interface GeoState {
  status: 'idle' | 'requesting' | 'granted' | 'denied' | 'error';
  latitude: number | null;
  longitude: number | null;
  address: string;
}

const STATUS_COLORS: Record<string, string> = {
  'PTP': 'bg-blue-100 text-blue-700',
  'Not Found': 'bg-gray-100 text-gray-700',
  'Partial Received': 'bg-yellow-100 text-yellow-700',
  'Received': 'bg-green-100 text-green-700',
  'Others': 'bg-purple-100 text-purple-700',
};

export default function NewVisit() {
  const { user } = useAuth();

  // Step control
  const [step, setStep] = useState<Step>('loan-entry');
  const [loanInput, setLoanInput] = useState('');
  const [loanError, setLoanError] = useState('');
  const [loanNumber, setLoanNumber] = useState('');

  // Form fields
  const [personVisited, setPersonVisited] = useState('');
  const [status, setStatus] = useState('');
  const [comments, setComments] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState('');

  // PTP fields
  const [ptpDate, setPtpDate] = useState('');
  const [ptpAmount, setPtpAmount] = useState('');

  // Geo
  const [geo, setGeo] = useState<GeoState>({ status: 'idle', latitude: null, longitude: null, address: '' });

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Past visits
  const [pastVisits, setPastVisits] = useState<Visit[]>([]);
  const [loadingPast, setLoadingPast] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Request geo on step 2
  useEffect(() => {
    if (step === 'visit-form') {
      requestGeo();
      loadPastVisits();
    }
  }, [step]);

  const requestGeo = () => {
    setGeo(g => ({ ...g, status: 'requesting' }));
    if (!navigator.geolocation) {
      setGeo(g => ({ ...g, status: 'error' }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setGeo(g => ({ ...g, status: 'granted', latitude: lat, longitude: lon }));
        try {
          const addr = await reverseGeocode(lat, lon);
          setGeo(g => ({ ...g, address: addr }));
        } catch {
          setGeo(g => ({ ...g, address: `${lat.toFixed(6)}, ${lon.toFixed(6)}` }));
        }
      },
      () => {
        setGeo({ status: 'denied', latitude: null, longitude: null, address: '' });
      },
      { timeout: 10000, maximumAge: 0 }
    );
  };

  const loadPastVisits = async () => {
    setLoadingPast(true);
    try {
      const data = await api.getMyVisits(loanNumber);
      setPastVisits(data.visits as Visit[]);
    } catch {
      setPastVisits([]);
    } finally {
      setLoadingPast(false);
    }
  };

  const handleLoanSubmit = (e: FormEvent) => {
    e.preventDefault();
    const val = loanInput.trim();
    if (!/^\d{21}$/.test(val)) {
      setLoanError('Loan number must be exactly 21 numeric digits');
      return;
    }
    setLoanError('');
    setLoanNumber(val);
    setStep('visit-form');
  };

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    setPhotoError('');

    const newFiles: File[] = [];
    let totalSize = photos.reduce((s, f) => s + f.size, 0);

    for (const file of Array.from(files)) {
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        setPhotoError('Only JPEG and PNG files are allowed');
        return;
      }
      if (photos.length + newFiles.length >= 5) {
        setPhotoError('Maximum 5 photos allowed');
        return;
      }
      totalSize += file.size;
      if (totalSize > 10 * 1024 * 1024) {
        setPhotoError('Total photo size must not exceed 10 MB');
        return;
      }
      newFiles.push(file);
    }

    const updatedPhotos = [...photos, ...newFiles];
    setPhotos(updatedPhotos);

    // Generate previews
    const readers = newFiles.map(file => {
      return new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then(newPreviews => {
      setPhotoPreviews(prev => [...prev, ...newPreviews]);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
    setPhotoError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (geo.status !== 'granted' || geo.latitude === null || geo.longitude === null) {
      setSubmitError('Location access is required to submit visit.');
      return;
    }

    if (photos.length === 0) {
      setSubmitError('At least 1 photo is required.');
      return;
    }

    if (!personVisited.trim() || !status || !comments.trim()) {
      setSubmitError('All fields are required.');
      return;
    }

    // PTP validation
    if (status === 'PTP') {
      if (!ptpDate) {
        setSubmitError('PTP Date is required.');
        return;
      }
      if (!ptpAmount || Number(ptpAmount) <= 0) {
        setSubmitError('PTP Amount must be a positive number.');
        return;
      }
    }

    setSubmitting(true);

    try {
      // Upload photos
      const photoUrls = await uploadPhotos(user!.id, photos);

      // Submit visit
      await api.submitVisit({
        loan_number: loanNumber,
        person_visited: personVisited.trim(),
        status,
        comments: comments.trim(),
        photo_urls: photoUrls,
        latitude: geo.latitude,
        longitude: geo.longitude,
        address: geo.address,
        ...(status === 'PTP' && {
          ptp_date: ptpDate,
          ptp_amount: Number(ptpAmount),
        }),
      });

      setSubmitted(true);
      // Reload past visits
      await loadPastVisits();
      // Reset form for another visit if needed
      setPersonVisited('');
      setStatus('');
      setComments('');
      setPhotos([]);
      setPhotoPreviews([]);
      setPtpDate('');
      setPtpAmount('');
      setSubmitted(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit visit');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  // ---- STEP 1: Loan Entry ----
  if (step === 'loan-entry') {
    return (
      <div className="p-4 max-w-md mx-auto mt-8">
        <div className="card">
          <h2 className="text-lg font-bold text-gray-900 mb-1">New Visit</h2>
          <p className="text-sm text-gray-500 mb-5">Enter the loan account number to begin</p>

          <form onSubmit={handleLoanSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="loan-id">Loan Account Number</label>
              <input
                id="loan-id"
                type="text"
                inputMode="numeric"
                maxLength={21}
                className="input-field font-mono text-base tracking-wider"
                placeholder="Enter 21-digit loan number"
                value={loanInput}
                onChange={e => {
                  setLoanInput(e.target.value.replace(/\D/g, ''));
                  setLoanError('');
                }}
              />
              {loanError && <p className="error-msg">{loanError}</p>}
              <p className="text-xs text-gray-400 mt-1">{loanInput.length}/21 digits</p>
            </div>

            <button type="submit" className="btn-primary w-full">
              Continue
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ---- STEP 2: Visit Form + Past Visits ----
  return (
    <div className="p-4 max-w-lg mx-auto pb-8">
      {/* Success flash */}
      {submitted && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <p className="text-green-800 font-semibold text-sm">Visit submitted successfully!</p>
        </div>
      )}

      {/* Loan number display */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Loan Number</p>
          <p className="font-mono font-bold text-brand-700 text-sm">{loanNumber}</p>
        </div>
        <button
          onClick={() => { setStep('loan-entry'); setLoanInput(''); }}
          className="text-xs text-gray-500 underline"
        >
          Change
        </button>
      </div>

      {/* Visit Form Card */}
      <div className="card mb-5">
        <h3 className="font-bold text-gray-900 mb-4">Record Visit</h3>

        {/* Location Status */}
        <div className={`rounded-xl p-3 mb-4 text-sm flex items-start gap-2 ${
          geo.status === 'granted' ? 'bg-green-50 border border-green-200' :
          geo.status === 'denied' ? 'bg-red-50 border border-red-200' :
          geo.status === 'requesting' ? 'bg-blue-50 border border-blue-200' :
          'bg-gray-50 border border-gray-200'
        }`}>
          {geo.status === 'requesting' && (
            <>
              <svg className="animate-spin w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="text-blue-700 font-medium">Fetching your location...</span>
            </>
          )}
          {geo.status === 'granted' && (
            <>
              <svg className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-green-800 font-semibold">Location captured</p>
                <p className="text-green-700 text-xs mt-0.5">{geo.address}</p>
                <p className="text-green-600 text-xs font-mono">{geo.latitude?.toFixed(6)}, {geo.longitude?.toFixed(6)}</p>
              </div>
            </>
          )}
          {geo.status === 'denied' && (
            <>
              <svg className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-red-700 font-semibold">Location access blocked</p>
                <p className="text-red-600 text-xs mt-1">
                  You have blocked location access. To fix this:
                </p>
                <p className="text-red-600 text-xs mt-0.5">
                  {isMobile
                    ? '1. Open browser Settings → Site Settings → Location → Allow this site'
                    : '1. Click the 🔒 lock icon in your browser address bar → Allow Location'}
                </p>
                <p className="text-red-600 text-xs">2. Then refresh this page</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-2 text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-semibold"
                >
                  Refresh Page
                </button>
              </div>
            </>
          )}
          {(geo.status === 'idle' || geo.status === 'error') && (
            <button onClick={requestGeo} className="text-blue-700 underline text-sm">
              Enable location
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Loan (readonly) */}
          <div>
            <label className="label">Loan Number</label>
            <input type="text" readOnly value={loanNumber}
              className="input-field bg-surface-1 text-gray-500 cursor-not-allowed font-mono" />
          </div>

          {/* Person Visited */}
          <div>
            <label className="label" htmlFor="person-visited">Person Name Visited</label>
            <input
              id="person-visited"
              type="text"
              className="input-field"
              placeholder="Full name of person met"
              value={personVisited}
              onChange={e => setPersonVisited(e.target.value)}
              required
            />
          </div>

          {/* Status */}
          <div>
            <label className="label" htmlFor="status">Visit Status</label>
            <select
              id="status"
              className="input-field"
              value={status}
              onChange={e => {
                setStatus(e.target.value);
                if (e.target.value !== 'PTP') {
                  setPtpDate('');
                  setPtpAmount('');
                }
              }}
              required
            >
              <option value="">Select status...</option>
              {VISIT_STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* PTP Fields — only shown when PTP is selected */}
          {status === 'PTP' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-4">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Promise to Pay Details</p>

              <div>
                <label className="label" htmlFor="ptp-date">
                  PTP Date <span className="text-red-500">*</span>
                </label>
                <input
                  id="ptp-date"
                  type="date"
                  className="input-field"
                  value={ptpDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setPtpDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label" htmlFor="ptp-amount">
                  PTP Amount (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  id="ptp-amount"
                  type="number"
                  inputMode="numeric"
                  className="input-field"
                  placeholder="Enter promised amount"
                  value={ptpAmount}
                  min={1}
                  onChange={e => setPtpAmount(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {/* Comments */}
          <div>
            <label className="label" htmlFor="comments">Comments</label>
            <textarea
              id="comments"
              className="input-field resize-none"
              rows={3}
              placeholder="Add visit notes..."
              value={comments}
              onChange={e => setComments(e.target.value)}
              required
            />
          </div>

          {/* Photos */}
          <div>
            <label className="label">Photos <span className="text-gray-400 font-normal">(1–5, JPEG/PNG, max 10 MB)</span></label>

            {/* Photo previews */}
            {photoPreviews.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {photoPreviews.map((src, i) => (
                  <div key={i} className="relative group">
                    <img src={src} alt={`Photo ${i + 1}`}
                      className="w-20 h-20 object-cover rounded-xl border-2 border-surface-3" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 text-white rounded-full text-xs flex items-center justify-center"
                    >×</button>
                  </div>
                ))}
              </div>
            )}

            {photos.length < 5 && (
              <div className="flex gap-2">
                {/* Camera — opens rear cam on mobile, webcam on desktop */}
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-brand-300 rounded-xl py-3 text-sm font-semibold text-brand-600 hover:bg-brand-50 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Camera
                </button>
                {/* Gallery / File picker */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Gallery
                </button>
              </div>
            )}

            {/* Hidden inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/png"
              capture="environment"
              className="hidden"
              onChange={(e: ChangeEvent<HTMLInputElement>) => addPhotos(e.target.files)}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              multiple
              className="hidden"
              onChange={(e: ChangeEvent<HTMLInputElement>) => addPhotos(e.target.files)}
            />

            {photoError && <p className="error-msg mt-2">{photoError}</p>}
            <p className="text-xs text-gray-400 mt-1">{photos.length}/5 photos selected</p>
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-red-700 text-sm font-medium">{submitError}</p>
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={submitting || geo.status === 'denied' || geo.status === 'requesting'}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Submitting...
              </span>
            ) : 'Submit Visit'}
          </button>
        </form>
      </div>

      {/* Past Visits */}
      <div>
        <h3 className="font-bold text-gray-900 mb-3">
          Past Visits
          <span className="ml-2 text-sm font-normal text-gray-500">for this loan</span>
        </h3>

        {loadingPast && (
          <div className="text-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-brand-600 border-t-transparent mx-auto" />
          </div>
        )}

        {!loadingPast && pastVisits.length === 0 && (
          <div className="card text-center py-8 text-gray-400">
            <p>No previous visits for this loan</p>
          </div>
        )}

        {!loadingPast && pastVisits.map(v => (
          <div key={v.id} className="card mb-3">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-gray-900 text-sm">{v.person_visited}</p>
                <p className="text-xs text-gray-500">{formatDate(v.visited_at)}</p>
              </div>
              <span className={`badge ${STATUS_COLORS[v.status] || 'bg-gray-100 text-gray-700'}`}>
                {v.status}
              </span>
            </div>

            <p className="text-sm text-gray-700 mb-2">{v.comments}</p>

            {/* PTP details */}
            {v.status === 'PTP' && v.ptp_date && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-2 text-xs text-blue-800 flex gap-4">
                <span>📅 PTP Date: <strong>{new Date(v.ptp_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></span>
                <span>💰 Amount: <strong>₹{v.ptp_amount?.toLocaleString('en-IN')}</strong></span>
              </div>
            )}

            <div className="flex items-start gap-1 text-xs text-gray-500 mb-3">
              <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <span>{v.address}</span>
            </div>

            {v.photo_urls?.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {v.photo_urls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt={`Photo ${i + 1}`}
                      className="w-16 h-16 object-cover rounded-lg border border-surface-3" />
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
