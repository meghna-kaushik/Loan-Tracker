const API_URL = import.meta.env.VITE_API_URL || '';

function getToken(): string {
  const stored = sessionStorage.getItem('loan_tracker_session');
  if (!stored) throw new Error('Not authenticated');
  const session = JSON.parse(stored);
  return session.token;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data as T;
}

// ---- VISIT APIs ----

export interface SubmitVisitPayload {
  loan_number: string;
  person_visited: string;
  status: string;
  comments: string;
  photo_urls: string[];
  latitude: number;
  longitude: number;
  address: string;
}

export const api = {
  // Agent: submit visit
  submitVisit: (payload: SubmitVisitPayload) =>
    apiFetch<{ visit: unknown }>('/api/visits', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Agent: get own visits for a loan number
  getMyVisits: (loanNumber: string) =>
    apiFetch<{ visits: unknown[] }>(`/api/visits/my?loan_number=${loanNumber}`),

  // Manager: search visits
  searchVisits: (params: { loan_number?: string; agent_query?: string }) => {
    const qs = new URLSearchParams();
    if (params.loan_number) qs.set('loan_number', params.loan_number);
    if (params.agent_query) qs.set('agent_query', params.agent_query);
    return apiFetch<{ visits: unknown[] }>(`/api/visits/search?${qs.toString()}`);
  },

  // Manager: list users
  getUsers: () => apiFetch<{ users: unknown[] }>('/api/users'),

  // Manager: create user
  createUser: (payload: { name: string; phone: string; password: string; role: string }) =>
    apiFetch<{ user: unknown }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Manager: deactivate user
  deactivateUser: (id: string) =>
    apiFetch<{ message: string }>(`/api/users/${id}/deactivate`, { method: 'PATCH' }),

  // Manager: reset password
  resetPassword: (id: string, newPassword: string) =>
    apiFetch<{ message: string }>(`/api/users/${id}/reset-password`, {
      method: 'PATCH',
      body: JSON.stringify({ new_password: newPassword }),
    }),

  // Manager: audit logs
  getAuditLogs: (action?: string) => {
    const qs = action ? `?action=${action}` : '';
    return apiFetch<{ logs: unknown[] }>(`/api/audit${qs}`);
  },
};

// ---- SUPABASE STORAGE UPLOAD ----
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export async function uploadPhotos(
  agentId: string,
  files: File[]
): Promise<string[]> {
  const timestamp = Date.now();
  const uploads = files.map(async (file, i) => {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${agentId}/${timestamp}/${i}.${ext}`;
    const { error } = await supabaseClient.storage
      .from('visit-photos')
      .upload(path, file, { contentType: file.type, upsert: false });

    if (error) throw new Error(`Failed to upload photo: ${error.message}`);

    const { data: urlData } = supabaseClient.storage
      .from('visit-photos')
      .getPublicUrl(path);

    return urlData.publicUrl;
  });

  return Promise.all(uploads);
}

// ---- REVERSE GEOCODING ----
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
    { headers: { 'Accept-Language': 'en' } }
  );
  if (!res.ok) throw new Error('Geocoding failed');
  const data = await res.json();
  return data.display_name || `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}
