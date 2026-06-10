import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { createDashboardApi, UserProfile } from "@/lib/dashboard-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, X, Save, LayoutDashboard } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile & Schedule — JobFit AI" }] }),
  component: ProfilePage,
});

// Common timezones for the dropdown
const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
];

function TagInput({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
      setInput("");
    }
  };

  const remove = (val: string) => onChange(values.filter((v) => v !== val));

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1 px-3">
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
            >
              {v}
              <button onClick={() => remove(v)} className="hover:text-destructive transition-colors">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfilePage() {
  const { getToken, loading: authLoading, user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [targetLocations, setTargetLocations] = useState<string[]>([]);
  const [minScore, setMinScore] = useState(60);
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduleTimezone, setScheduleTimezone] = useState("America/Chicago");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    getToken().then((token) => {
      const api = createDashboardApi(token);
      api.getProfile()
        .then(({ data }) => {
          setProfile(data);
          setResumeText(data.resume_text || "");
          setTargetRoles(data.target_roles || []);
          setTargetLocations(data.target_locations || []);
          setMinScore(data.min_score ?? 60);
          setScheduleTime(data.schedule_time?.slice(0, 5) || "09:00");
          setScheduleTimezone(data.schedule_timezone || "America/Chicago");
          setScheduleEnabled(data.schedule_enabled ?? false);
        })
        .catch(() => toast.error("Failed to load profile."))
        .finally(() => setLoadingProfile(false));
    });
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await getToken();
      const api = createDashboardApi(token);
      await api.updateProfile({
        resume_text: resumeText,
        target_roles: targetRoles,
        target_locations: targetLocations,
        min_score: minScore,
        schedule_time: scheduleTime,
        schedule_timezone: scheduleTimezone,
        schedule_enabled: scheduleEnabled,
        onboarded: true,
      });
      toast.success("Profile saved!");
    } catch {
      toast.error("Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Profile & Schedule</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Configure your resume, job preferences, and pipeline schedule
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => navigate({ to: "/dashboard" })}
            >
              <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
            </Button>
            <Button size="sm" className="gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6">

        {/* Resume */}
        <section className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Resume</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Paste your resume as plain text. The agent uses this to score and tailor applications.
            </p>
          </div>
          <Textarea
            placeholder="Paste your full resume text here..."
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            className="min-h-[240px] font-mono text-xs leading-relaxed resize-y"
          />
          <p className="text-xs text-muted-foreground">
            {resumeText.length.toLocaleString()} characters
          </p>
        </section>

        {/* Job Preferences */}
        <section className="rounded-xl border border-border bg-card p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">Job Preferences</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              The agent scrapes and scores jobs based on these settings.
            </p>
          </div>

          <TagInput
            label="Target Roles"
            placeholder="e.g. Business Analyst"
            values={targetRoles}
            onChange={setTargetRoles}
          />

          <TagInput
            label="Target Locations"
            placeholder="e.g. Remote, Oklahoma City OK"
            values={targetLocations}
            onChange={setTargetLocations}
          />

          <div className="space-y-1.5">
            <Label htmlFor="min-score">
              Minimum Match Score: <span className="font-bold text-foreground">{minScore}%</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Jobs scoring below this threshold are skipped and won't have resumes tailored.
            </p>
            <input
              id="min-score"
              type="range"
              min={40}
              max={90}
              step={5}
              value={minScore}
              onChange={(e) => setMinScore(parseInt(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>40% (More applications)</span>
              <span>90% (Only strong matches)</span>
            </div>
          </div>
        </section>

        {/* Pipeline Schedule */}
        <section className="rounded-xl border border-border bg-card p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Daily Pipeline Schedule</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                The agent will automatically scrape, score, and tailor jobs once per day at your chosen time.
              </p>
            </div>
            <Switch
              checked={scheduleEnabled}
              onCheckedChange={setScheduleEnabled}
              className="mt-1 shrink-0"
            />
          </div>

          <div className={`space-y-4 transition-opacity ${scheduleEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="schedule-time">Time</Label>
                <Input
                  id="schedule-time"
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="timezone">Timezone</Label>
                <select
                  id="timezone"
                  value={scheduleTimezone}
                  onChange={(e) => setScheduleTimezone(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
            </div>

            {scheduleEnabled && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-900/20">
                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                  Pipeline will run every day at <strong>{scheduleTime}</strong> ({scheduleTimezone}).
                  Save your profile to apply changes.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Save button */}
        <div className="flex justify-end">
          <Button size="lg" className="gap-2 px-8" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </div>
    </div>
  );
}
