import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { createDashboardApi, Application, ApplicationStatus, DashboardStats } from "@/lib/dashboard-api";
import { useAuth } from "@/lib/auth-context";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { ApplicationCard } from "@/components/dashboard/ApplicationCard";
import { ApplicationDrawer } from "@/components/dashboard/ApplicationDrawer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, Play, Loader2, UserCircle, AlertTriangle, LogOut, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Job Application Agent" },
      { name: "description", content: "Review and manage your AI-tailored job applications." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { getToken, loading: authLoading, user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [profileReady, setProfileReady] = useState<boolean | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<{ status: string; jobs_scraped: number; jobs_scored: number; jobs_tailored: number; error_message: string | null } | null>(null);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  // Check profile completeness
  useEffect(() => {
    if (!user) return;
    getToken().then((token) => {
      const api = createDashboardApi(token);
      api.getProfile()
        .then(({ data }) => {
          const ready = !!(data.resume_text?.trim() && data.target_roles?.length > 0);
          setProfileReady(ready);
        })
        .catch(() => setProfileReady(false));
    });
  }, [user]);

  // Poll active run status every 8 seconds
  useEffect(() => {
    if (!activeRunId) return;
    const poll = async () => {
      try {
        const token = await getToken();
        const api = createDashboardApi(token);
        const res = await api.getRunStatus(activeRunId);
        setRunStatus(res.data);
        if (res.data.status === "completed") {
          setActiveRunId(null);
          toast.success("Pipeline complete! Refreshing applications...");
          fetchData(true);
        } else if (res.data.status === "failed") {
          setActiveRunId(null);
          toast.error(`Pipeline failed: ${res.data.error_message ?? "Unknown error"}`);
        }
      } catch {
        // silently ignore poll errors
      }
    };
    poll();
    const interval = setInterval(poll, 8000);
    return () => clearInterval(interval);
  }, [activeRunId]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [statusFilter, debouncedSearch]);

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    const token = await getToken();
    const api = createDashboardApi(token);
    try {
      const [statsRes, appsRes] = await Promise.all([
        api.getStats(),
        api.listApplications({
          status: statusFilter as ApplicationStatus | undefined,
          search: debouncedSearch || undefined,
          page,
          limit: 20,
        }),
      ]);
      setStats(statsRes.data);
      setApplications(appsRes.data);
      setTotalPages(appsRes.pagination.pages);
    } catch {
      // Silently show empty state — API may be unreachable for new users
      // or FRONTEND_URL not yet configured on the backend
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, debouncedSearch, page]);

  useEffect(() => { if (user) fetchData(); }, [fetchData, user]);

  const triggerRun = async () => {
    if (!profileReady) {
      toast.error("Set up your profile first before running the pipeline.");
      navigate({ to: "/profile" });
      return;
    }
    setRunLoading(true);
    try {
      const token = await getToken();
      const api = createDashboardApi(token);
      const json = await api.triggerRun();
      setActiveRunId(json.runId);
      setRunStatus({ status: "running", jobs_scraped: 0, jobs_scored: 0, jobs_tailored: 0, error_message: null });
      toast.success("Pipeline started!");
    } catch (err: unknown) {
      toast.error(`Failed to start pipeline: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setRunLoading(false);
    }
  };

  const openDrawer = async (app: Application) => {
    try {
      const token = await getToken();
      const api = createDashboardApi(token);
      const res = await api.getApplication(app.id);
      setSelectedApp(res.data);
      setDrawerOpen(true);
    } catch {
      toast.error("Failed to load application details.");
    }
  };

  const handleStatusChange = (id: string, newStatus: ApplicationStatus) => {
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a)));
    getToken().then((token) => createDashboardApi(token).getStats().then((r) => setStats(r.data)).catch(() => {}));
  };

  // Auth loading
  if (authLoading) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-foreground">Application Dashboard</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Review AI-tailored applications before they go out
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => fetchData(true)} disabled={refreshing}>
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link to="/profile">
                  <UserCircle className="h-3.5 w-3.5" /> Profile
                </Link>
              </Button>
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={handleSignOut}>
                <LogOut className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" className="gap-2" onClick={triggerRun} disabled={runLoading || !!activeRunId || profileReady === false}>
                {(runLoading || activeRunId) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                {activeRunId ? "Running…" : "Run Pipeline"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">

        {/* Pipeline running banner */}
        {activeRunId && runStatus && (
          <div className="flex items-center gap-4 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Pipeline running…</p>
              <p className="text-xs text-muted-foreground">
                {runStatus.jobs_scraped > 0 && `${runStatus.jobs_scraped} scraped`}
                {runStatus.jobs_scored > 0 && ` · ${runStatus.jobs_scored} scored`}
                {runStatus.jobs_tailored > 0 && ` · ${runStatus.jobs_tailored} tailored`}
                {runStatus.jobs_scraped === 0 && "Scraping jobs…"}
              </p>
            </div>
            <div className="flex gap-2 text-xs text-muted-foreground shrink-0">
              <span className={runStatus.jobs_scraped > 0 ? "text-primary font-medium" : ""}>Scrape</span>
              <span>→</span>
              <span className={runStatus.jobs_scored > 0 ? "text-primary font-medium" : ""}>Score</span>
              <span>→</span>
              <span className={runStatus.jobs_tailored > 0 ? "text-primary font-medium" : ""}>Tailor</span>
            </div>
          </div>
        )}

        {/* Profile incomplete banner */}
        {profileReady === false && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-800 dark:bg-amber-900/20">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Profile not set up</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Add your resume and target roles before running the pipeline.
                </p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300">
              <Link to="/profile">
                <UserCircle className="mr-1.5 h-3.5 w-3.5" /> Set Up Profile
              </Link>
            </Button>
          </div>
        )}

        {/* Stats */}
        {stats && <StatsBar stats={stats} activeFilter={statusFilter} onFilter={setStatusFilter} />}

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Applications grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">No applications found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {statusFilter || debouncedSearch
                ? "Try adjusting your filters"
                : profileReady
                  ? "Run the pipeline to start scraping and scoring jobs"
                  : "Set up your profile first, then run the pipeline"}
            </p>
            {!statusFilter && !debouncedSearch && (
              profileReady === false ? (
                <Button asChild className="mt-4 gap-2">
                  <Link to="/profile">
                    <UserCircle className="h-4 w-4" /> Set Up Profile
                  </Link>
                </Button>
              ) : (
                <Button className="mt-4 gap-2" onClick={triggerRun} disabled={runLoading}>
                  {runLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Run Pipeline Now
                </Button>
              )
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {applications.map((app) => (
                <ApplicationCard key={app.id} application={app} onClick={() => openDrawer(app)} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <ApplicationDrawer
        application={selectedApp}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedApp(null); }}
        onStatusChange={handleStatusChange}
        getToken={getToken}
      />
    </div>
  );
}
