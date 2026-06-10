import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Search, Star, Bot, CheckCircle, Clock, Shield, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JobFit AI — Your Automated Job Application Agent" },
      {
        name: "description",
        content:
          "Set your resume once. JobFit AI scrapes LinkedIn, Indeed, and Glassdoor daily, scores every job, and prepares tailored applications — ready for your review.",
      },
    ],
  }),
  component: Index,
});

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Set up your profile",
    desc: "Paste your resume, add your target roles and locations, and set your minimum match score. Takes about 5 minutes.",
  },
  {
    step: "02",
    title: "Agent runs on your schedule",
    desc: "Every day at your chosen time, the agent scrapes fresh listings, scores each one with Gemini AI, and tailors a resume + cover letter for every strong match.",
  },
  {
    step: "03",
    title: "Review and approve",
    desc: "Open the dashboard, read through each tailored application, and approve the ones you want to send. You stay in control.",
  },
];

const STATS = [
  { value: "3", label: "Job boards scraped" },
  { value: "AI", label: "Match scoring" },
  { value: "Daily", label: "Automated runs" },
  { value: "100%", label: "You control what goes out" },
];

function Index() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />

        {/* How it works */}
        <section id="how-it-works" className="border-t border-border/60 bg-muted/30 py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="mb-12 text-center">
              <h2 className="font-display text-3xl font-semibold">How it works</h2>
              <p className="mt-2 text-muted-foreground">
                Three steps from setup to applications in your inbox.
              </p>
            </div>

            <div className="grid gap-8 sm:grid-cols-3">
              {HOW_IT_WORKS.map(({ step, title, desc }) => (
                <div key={step} className="relative">
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 font-display text-lg font-bold text-primary">
                    {step}
                  </div>
                  <h3 className="font-display text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats strip */}
        <section className="border-y border-border/60 bg-card py-10">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {STATS.map(({ value, label }) => (
                <div key={label} className="text-center">
                  <div className="font-display text-3xl font-bold text-primary">{value}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Feature details */}
        <section className="py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="mb-12 text-center">
              <h2 className="font-display text-3xl font-semibold">Everything automated</h2>
              <p className="mt-2 text-muted-foreground">
                From scraping to tailored documents — no manual work required.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: Search,
                  title: "Multi-source scraping",
                  desc: "Pulls from LinkedIn, Indeed, and Glassdoor simultaneously. Deduplicates across sources so you never see the same job twice.",
                },
                {
                  icon: Star,
                  title: "Smart match scoring",
                  desc: "Gemini reads your resume and each job description, then returns a score plus a written explanation of your fit.",
                },
                {
                  icon: Bot,
                  title: "Tailored documents",
                  desc: "For every qualifying job, the agent rewrites your resume bullets to match the role and drafts a cover letter from scratch.",
                },
                {
                  icon: Clock,
                  title: "Runs on your schedule",
                  desc: "Pick any time in your timezone. The agent fires once a day — you wake up to new applications ready for review.",
                },
                {
                  icon: Shield,
                  title: "You stay in control",
                  desc: "Every application sits in 'pending review' until you approve it. Nothing goes out automatically.",
                },
                {
                  icon: Zap,
                  title: "Trigger anytime",
                  desc: "Don't want to wait? Hit 'Run Pipeline' from the dashboard to kick off a manual scrape right now.",
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-border/60 bg-gradient-card p-5 shadow-card"
                >
                  <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="font-display text-base font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border/60 bg-muted/30 py-20">
          <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
            <h2 className="font-display text-3xl font-semibold">
              Ready to automate your job search?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Sign up, paste your resume, and let the agent do the heavy lifting.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {!loading && user ? (
                <Button asChild size="lg" className="bg-gradient-brand text-primary-foreground shadow-glow hover:opacity-95">
                  <Link to="/dashboard">
                    Open Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg" className="bg-gradient-brand text-primary-foreground shadow-glow hover:opacity-95">
                    <Link to="/signup">
                      Create free account <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link to="/login">Sign in</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} JobFit AI · Automated Job Application Agent</p>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-foreground transition-colors">Sign In</Link>
            <Link to="/signup" className="hover:text-foreground transition-colors">Sign Up</Link>
            <Link to="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
