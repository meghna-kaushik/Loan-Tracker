-- ============================================================
-- LOAN COLLECTION VISIT TRACKER - DATABASE SCHEMA + RLS
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PROFILES TABLE (extends auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('collection_manager', 'field_agent')),
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VISITS TABLE (append-only)
-- ============================================================
CREATE TABLE public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_number TEXT NOT NULL CHECK (char_length(loan_number) = 21),
  agent_id UUID NOT NULL REFERENCES public.profiles(id),
  agent_name TEXT NOT NULL,
  agent_phone TEXT NOT NULL,
  person_visited TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PTP', 'Not Found', 'Partial Received', 'Received', 'Others')),
  comments TEXT NOT NULL,
  photo_urls TEXT[] NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT NOT NULL,
  visited_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOGS TABLE
-- ============================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  performed_by UUID NOT NULL REFERENCES public.profiles(id),
  performed_by_name TEXT NOT NULL,
  target_user_id UUID REFERENCES public.profiles(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- PROFILES RLS POLICIES
-- ============================================================

-- Users can read their own profile
CREATE POLICY "profiles_read_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- Collection managers can read all profiles
CREATE POLICY "profiles_read_all_managers"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() = 'collection_manager');

-- Collection managers can insert new profiles
CREATE POLICY "profiles_insert_managers"
  ON public.profiles FOR INSERT
  WITH CHECK (public.get_my_role() = 'collection_manager');

-- Collection managers can update is_active only
CREATE POLICY "profiles_update_active_managers"
  ON public.profiles FOR UPDATE
  USING (public.get_my_role() = 'collection_manager')
  WITH CHECK (public.get_my_role() = 'collection_manager');

-- No delete allowed
-- (No DELETE policy = no deletes permitted)

-- ============================================================
-- VISITS RLS POLICIES
-- ============================================================

-- Field agents can insert their own visits
CREATE POLICY "visits_insert_agent"
  ON public.visits FOR INSERT
  WITH CHECK (agent_id = auth.uid() AND public.get_my_role() = 'field_agent');

-- Field agents can read their own visits
CREATE POLICY "visits_select_agent"
  ON public.visits FOR SELECT
  USING (agent_id = auth.uid() AND public.get_my_role() = 'field_agent');

-- Collection managers can read all visits
CREATE POLICY "visits_select_managers"
  ON public.visits FOR SELECT
  USING (public.get_my_role() = 'collection_manager');

-- NO UPDATE or DELETE policies = immutable visits

-- ============================================================
-- AUDIT LOGS RLS POLICIES
-- ============================================================

-- Collection managers can read audit logs
CREATE POLICY "audit_select_managers"
  ON public.audit_logs FOR SELECT
  USING (public.get_my_role() = 'collection_manager');

-- Only service role can insert (handled by backend with service key)
-- No user-level insert policy needed

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('visit-photos', 'visit-photos', true)
ON CONFLICT DO NOTHING;

-- Storage policy: agents can upload to their own folder
CREATE POLICY "storage_upload_agent"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'visit-photos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Anyone can read photos (public bucket)
CREATE POLICY "storage_read_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'visit-photos');
