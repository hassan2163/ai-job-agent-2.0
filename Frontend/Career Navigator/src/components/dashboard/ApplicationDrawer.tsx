import { useState } from "react";
import { Application, ApplicationStatus, createDashboardApi } from "@/lib/dashboard-api";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  XCircle,
  ExternalLink,
  Copy,
  MapPin,
  Building2,
  Layers,
  FileText,
  FileDown,
  Loader2,
} from "lucide-react";

interface Props {
  application: Application | null;
  open: boolean;
  onClose: () => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  getToken: () => Promise<string | null>;
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied to clipboard`));
}

const API_URL = import.meta.env.VITE_API_URL ?? "";

async function downloadFile(appId: string, type: string, token: string | null) {
  const res = await fetch(
    `${API_URL}/api/dashboard/applications/${appId}/download?type=${type}`,
    { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
  );
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const cd = res.headers.get("Content-Disposition") ?? "";
  const match = cd.match(/filename="(.+?)"/);
  a.download = match ? match[1] : `download.${type.endsWith("pdf") ? "pdf" : "docx"}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function ResumeView({ resume }: { resume: Application["tailored_resume"] }) {
  if (!resume) return <p className="text-sm text-muted-foreground">No tailored resume generated.</p>;

  return (
    <div className="space-y-5 text-sm">
      {/* Contact */}
      {resume.contact && (
        <div>
          <p className="font-bold text-base text-foreground">{resume.contact.fullName}</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            {[resume.contact.location, resume.contact.email, resume.contact.phone, resume.contact.linkedin]
              .filter(Boolean).join(" · ")}
          </p>
        </div>
      )}

      {/* Headline */}
      {resume.headline && (
        <p className="font-semibold text-foreground border-l-2 border-primary pl-3">
          {resume.headline}
        </p>
      )}

      {/* Summary */}
      {resume.professionalSummary && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Summary</h4>
          <p className="leading-relaxed text-foreground">{resume.professionalSummary}</p>
        </div>
      )}

      {/* Skills */}
      {resume.coreSkills && resume.coreSkills.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Skills</h4>
          <div className="flex flex-wrap gap-1.5">
            {resume.coreSkills.map((s, i) => (
              <span key={i} className="rounded-md bg-muted px-2 py-0.5 text-xs text-foreground">{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* Experience */}
      {resume.professionalExperience && resume.professionalExperience.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Experience</h4>
          <div className="space-y-4">
            {resume.professionalExperience.map((role, i) => (
              <div key={i}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{role.title}</p>
                    <p className="text-xs text-muted-foreground">{role.company} · {role.location}</p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">{role.dates}</p>
                </div>
                <ul className="mt-2 space-y-1.5 pl-4">
                  {role.bullets.map((b, j) => (
                    <li key={j} className="relative text-foreground before:absolute before:-left-3 before:text-muted-foreground before:content-['·']">
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {resume.education && resume.education.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Education</h4>
          {resume.education.map((e, i) => (
            <div key={i}>
              <p className="font-semibold text-foreground">{e.degree} in {e.field}</p>
              <p className="text-xs text-muted-foreground">{e.institution} · {e.dates || e.year}</p>
            </div>
          ))}
        </div>
      )}

      {/* Certifications */}
      {resume.certifications && resume.certifications.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Certifications</h4>
          {resume.certifications.map((c, i) => (
            <p key={i} className="text-foreground">{c}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function AnalysisView({ match }: { match: Application["job_matches"] }) {
  const m = Array.isArray(match) ? match[0] : match;
  if (!m) return <p className="text-sm text-muted-foreground">No analysis available.</p>;

  const a = m.analysis;

  return (
    <div className="space-y-5 text-sm">
      {/* Score + Decision */}
      <div className="flex items-center gap-4">
        <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold ${
          m.match_score >= 80 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          : m.match_score >= 60 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
          : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
        }`}>
          {m.match_score}%
        </div>
        <div>
          <p className="font-semibold text-foreground">{m.decision.replace("_", " ")}</p>
          {a?.fitSummary && <p className="mt-1 text-muted-foreground leading-relaxed">{a.fitSummary}</p>}
        </div>
      </div>

      <Separator />

      {/* Strengths */}
      {a?.strengths && a.strengths.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">Strengths</h4>
          <ul className="space-y-1.5">
            {a.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-foreground">
                <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Gaps */}
      {a?.gaps && a.gaps.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-2">Gaps</h4>
          <ul className="space-y-1.5">
            {a.gaps.map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-foreground">
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                {g}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Keywords */}
      {a?.matchedKeywords && a.matchedKeywords.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Matched Keywords</h4>
          <div className="flex flex-wrap gap-1.5">
            {a.matchedKeywords.map((k, i) => (
              <span key={i} className="rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 px-2 py-0.5 text-xs">{k}</span>
            ))}
          </div>
        </div>
      )}

      {/* Missing Keywords */}
      {a?.missingKeywords && a.missingKeywords.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Missing Keywords</h4>
          <div className="flex flex-wrap gap-1.5">
            {a.missingKeywords.map((k, i) => (
              <span key={i} className="rounded-md bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400 px-2 py-0.5 text-xs">{k}</span>
            ))}
          </div>
        </div>
      )}

      {/* Strategy */}
      {a?.strategy && (
        <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Strategy</h4>
          {a.strategy.positioning && <p className="text-foreground"><span className="font-medium">Positioning: </span>{a.strategy.positioning}</p>}
          {a.strategy.whatToSay && <p className="text-foreground"><span className="font-medium">What to say: </span>{a.strategy.whatToSay}</p>}
          {a.strategy.riskLevel && (
            <p className="text-foreground">
              <span className="font-medium">Risk: </span>
              <span className={a.strategy.riskLevel === "LOW" ? "text-emerald-600" : a.strategy.riskLevel === "HIGH" ? "text-rose-600" : "text-amber-600"}>
                {a.strategy.riskLevel}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Do Not Claim */}
      {a?.doNotClaim && a.doNotClaim.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-2">Do Not Claim</h4>
          <div className="flex flex-wrap gap-1.5">
            {a.doNotClaim.map((k, i) => (
              <span key={i} className="rounded-md bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400 px-2 py-0.5 text-xs line-through opacity-70">{k}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ApplicationDrawer({ application, open, onClose, onStatusChange, getToken }: Props) {
  const [loading, setLoading] = useState<"approve" | "skip" | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  if (!application) return null;

  const handleDownload = async (type: string) => {
    setDownloading(type);
    try {
      const token = await getToken();
      await downloadFile(application.id, type, token);
    } catch {
      toast.error("Failed to download document. Please try again.");
    } finally {
      setDownloading(null);
    }
  };

  const listing = application.job_listings;

  const handleAction = async (action: "approve" | "skip") => {
    setLoading(action);
    try {
      const newStatus: ApplicationStatus = action === "approve" ? "approved" : "skipped";
      const token = await getToken();
      const api = createDashboardApi(token);
      await api.updateApplication(application.id, { status: newStatus });
      onStatusChange(application.id, newStatus);
      toast.success(action === "approve" ? "Application approved!" : "Application skipped.");
      onClose();
    } catch {
      toast.error("Failed to update application.");
    } finally {
      setLoading(null);
    }
  };

  const coverLetterText = application.cover_letter ?? "";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto flex flex-col p-0"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border sticky top-0 bg-background z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="truncate text-base leading-tight">
                {listing.title}
              </SheetTitle>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> {listing.company}
                </span>
                {listing.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {listing.location}
                  </span>
                )}
                <span className="flex items-center gap-1 capitalize">
                  <Layers className="h-3 w-3" /> {listing.source}
                </span>
              </div>
            </div>
            <a
              href={listing.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
              title="Open original job posting"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 px-6 py-5">
          <Tabs defaultValue="resume">
            <TabsList className="w-full mb-5">
              <TabsTrigger value="resume" className="flex-1">Tailored Resume</TabsTrigger>
              <TabsTrigger value="cover" className="flex-1">Cover Letter</TabsTrigger>
              <TabsTrigger value="analysis" className="flex-1">Analysis</TabsTrigger>
            </TabsList>

            <TabsContent value="resume">
              <div className="flex items-center justify-end gap-2 mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => handleDownload("resume-docx")}
                  disabled={!!downloading}
                >
                  {downloading === "resume-docx"
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <FileText className="h-3 w-3" />}
                  Word
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => handleDownload("resume-pdf")}
                  disabled={!!downloading}
                >
                  {downloading === "resume-pdf"
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <FileDown className="h-3 w-3" />}
                  PDF
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => copyToClipboard(JSON.stringify(application.tailored_resume, null, 2), "Resume JSON")}
                >
                  <Copy className="h-3 w-3" /> Copy
                </Button>
              </div>
              <ResumeView resume={application.tailored_resume} />
            </TabsContent>

            <TabsContent value="cover">
              <div className="flex items-center justify-end gap-2 mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => handleDownload("cover-docx")}
                  disabled={!!downloading}
                >
                  {downloading === "cover-docx"
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <FileText className="h-3 w-3" />}
                  Word
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => handleDownload("cover-pdf")}
                  disabled={!!downloading}
                >
                  {downloading === "cover-pdf"
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <FileDown className="h-3 w-3" />}
                  PDF
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => copyToClipboard(coverLetterText, "Cover letter")}
                >
                  <Copy className="h-3 w-3" /> Copy
                </Button>
              </div>
              {coverLetterText ? (
                <div className="rounded-lg border border-border bg-muted/30 p-5">
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{coverLetterText}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No cover letter generated.</p>
              )}
            </TabsContent>

            <TabsContent value="analysis">
              <AnalysisView match={application.job_matches} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Action bar — only shown for pending_review */}
        {application.status === "pending_review" && (
          <div className="sticky bottom-0 border-t border-border bg-background px-6 py-4 flex gap-3">
            <Button
              className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => handleAction("approve")}
              disabled={!!loading}
            >
              <CheckCircle className="h-4 w-4" />
              {loading === "approve" ? "Approving..." : "Approve"}
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2 border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-900/20"
              onClick={() => handleAction("skip")}
              disabled={!!loading}
            >
              <XCircle className="h-4 w-4" />
              {loading === "skip" ? "Skipping..." : "Skip"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
