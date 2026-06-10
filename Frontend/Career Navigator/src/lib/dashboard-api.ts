const API_URL = import.meta.env.VITE_API_URL ?? "";

async function apiFetch<T>(path: string, options?: RequestInit, token?: string | null): Promise<T> {
  if (!API_URL) throw new Error("VITE_API_URL is not configured.");
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApplicationStatus =
  | "pending_review"
  | "approved"
  | "skipped"
  | "applying"
  | "applied"
  | "failed";

export type Decision = "APPLY" | "APPLY_WITH_CAUTION" | "SKIP";

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string | null;
  source: "linkedin" | "indeed" | "glassdoor" | "company";
  url: string;
  description?: string;
  job_type?: string | null;
  salary_range?: string | null;
  posted_at?: string | null;
}

export interface JobMatch {
  match_score: number;
  decision: Decision;
  scored_at?: string;
  analysis: {
    fitSummary?: string;
    strengths?: string[];
    gaps?: string[];
    matchedKeywords?: string[];
    missingKeywords?: string[];
    doNotClaim?: string[];
    strategy?: { positioning?: string; whatToSay?: string; riskLevel?: string };
  };
}

export interface TailoredResume {
  contact?: { fullName?: string; location?: string; phone?: string; email?: string; linkedin?: string };
  headline?: string;
  professionalSummary?: string;
  coreSkills?: string[];
  professionalExperience?: Array<{
    company: string; title: string; dates: string; location: string; bullets: string[];
  }>;
  education?: Array<{
    institution: string; degree: string; field: string; dates?: string; year?: string;
  }>;
  certifications?: string[];
}

export interface Application {
  id: string;
  status: ApplicationStatus;
  notes: string | null;
  created_at: string;
  approved_at: string | null;
  applied_at: string | null;
  updated_at?: string;
  error_message?: string | null;
  tailored_resume?: TailoredResume | null;
  cover_letter?: string | null;
  job_listings: JobListing;
  job_matches: JobMatch | JobMatch[];
}

export interface DashboardStats {
  total: number;
  pending: number;
  approved: number;
  applied: number;
  skipped: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  resume_text: string;
  target_roles: string[];
  target_locations: string[];
  min_score: number;
  schedule_time: string;
  schedule_timezone: string;
  schedule_enabled: boolean;
  onboarded: boolean;
}

// ─── API factory — call with token ───────────────────────────────────────────

export const createDashboardApi = (token: string | null) => ({
  getStats: () =>
    apiFetch<{ success: boolean; data: DashboardStats }>("/api/dashboard/stats", undefined, token),

  listApplications: (params?: {
    status?: ApplicationStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.search) qs.set("search", params.search);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<{ success: boolean; data: Application[]; pagination: Pagination }>(
      `/api/dashboard/applications${query}`, undefined, token
    );
  },

  getApplication: (id: string) =>
    apiFetch<{ success: boolean; data: Application }>(
      `/api/dashboard/applications/${id}`, undefined, token
    ),

  updateApplication: (id: string, patch: { status: ApplicationStatus; notes?: string }) =>
    apiFetch<{ success: boolean; data: Partial<Application> }>(
      `/api/dashboard/applications/${id}`,
      { method: "PATCH", body: JSON.stringify(patch) },
      token
    ),

  triggerRun: () =>
    apiFetch<{ success: boolean; runId: string; message: string }>(
      "/api/agent/run",
      { method: "POST" },
      token
    ),

  getRunStatus: (runId: string) =>
    apiFetch<{ success: boolean; data: {
      id: string; status: string; jobs_scraped: number;
      jobs_scored: number; jobs_tailored: number; error_message: string | null;
      started_at: string; completed_at: string | null;
    } }>(`/api/agent/status/${runId}`, undefined, token),

  getProfile: () =>
    apiFetch<{ success: boolean; data: UserProfile }>("/api/profile", undefined, token),

  updateProfile: (patch: Partial<UserProfile>) =>
    apiFetch<{ success: boolean; data: UserProfile }>(
      "/api/profile",
      { method: "PATCH", body: JSON.stringify(patch) },
      token
    ),
});
