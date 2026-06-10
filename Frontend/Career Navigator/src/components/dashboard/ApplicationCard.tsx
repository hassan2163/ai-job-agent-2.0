import { Application, ApplicationStatus } from "@/lib/dashboard-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, MapPin, Building2, Calendar } from "lucide-react";

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; className: string }> = {
  pending_review: { label: "Pending Review", className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400" },
  approved:       { label: "Approved",        className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400" },
  skipped:        { label: "Skipped",         className: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400" },
  applying:       { label: "Applying",        className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400" },
  applied:        { label: "Applied",         className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400" },
  failed:         { label: "Failed",          className: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400" },
};

const DECISION_CONFIG = {
  APPLY:                { label: "Strong Match",  className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  APPLY_WITH_CAUTION:   { label: "Partial Match", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  SKIP:                 { label: "Low Match",     className: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" },
};

const SOURCE_LOGO: Record<string, string> = {
  linkedin:  "LI",
  indeed:    "IN",
  glassdoor: "GD",
  company:   "CO",
};

interface ApplicationCardProps {
  application: Application;
  onClick: () => void;
}

// Glassdoor returns company/location as JSON objects — extract the name field
function parseName(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return parsed?.name ?? val;
    } catch {
      return val;
    }
  }
  if (typeof val === "object" && val !== null && "name" in val) {
    return (val as { name: string }).name;
  }
  return String(val);
}

export function ApplicationCard({ application, onClick }: ApplicationCardProps) {
  const listing = application.job_listings;
  const match = Array.isArray(application.job_matches)
    ? application.job_matches[0]
    : application.job_matches;

  const status = STATUS_CONFIG[application.status] ?? STATUS_CONFIG.pending_review;
  const decision = match ? DECISION_CONFIG[match.decision] : null;

  const postedDate = listing.posted_at
    ? new Date(listing.posted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Source badge */}
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
            {SOURCE_LOGO[listing.source] ?? "??"}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground leading-tight">
              {listing.title}
            </h3>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{parseName(listing.company)}</span>
            </div>
          </div>
        </div>

        {/* Score circle */}
        {match && (
          <div className="shrink-0 flex flex-col items-center">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold ${
                match.match_score >= 80
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : match.match_score >= 60
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
              }`}
            >
              {match.match_score}%
            </div>
          </div>
        )}
      </div>

      {/* Meta row */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {listing.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {parseName(listing.location)}
          </span>
        )}
        {postedDate && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {postedDate}
          </span>
        )}
      </div>

      {/* Badges row */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
          {status.label}
        </span>
        {decision && (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${decision.className}`}>
            {decision.label}
          </span>
        )}
      </div>

      {/* Fit summary */}
      {match?.analysis?.fitSummary && (
        <p className="mt-3 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
          {match.analysis.fitSummary}
        </p>
      )}

      {/* External link */}
      <a
        href={listing.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
