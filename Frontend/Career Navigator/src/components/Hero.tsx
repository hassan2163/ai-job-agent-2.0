import { ArrowRight, Bot, Search, Star, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

export function Hero() {
  const { user, loading } = useAuth();

  return (
    <section id="top" className="relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground shadow-soft">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            Fully automated · Runs daily on your schedule
          </div>

          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-6xl">
            Your personal{" "}
            <span className="text-gradient-brand">AI job agent</span>
          </h1>

          <p className="mt-5 text-base text-muted-foreground sm:text-lg">
            Set your resume and target roles once. The agent scrapes LinkedIn, Indeed, and
            Glassdoor daily, scores every listing against your profile, and generates a
            tailored resume + cover letter — ready for your review.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {!loading && user ? (
              <Button asChild size="lg" className="bg-gradient-brand text-primary-foreground shadow-glow hover:opacity-95">
                <Link to="/dashboard">
                  Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg" className="bg-gradient-brand text-primary-foreground shadow-glow hover:opacity-95">
                  <Link to="/signup">
                    Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="#how-it-works">See how it works</a>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Feature cards */}
        <div
          id="features"
          className="mx-auto mt-16 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {[
            {
              icon: Search,
              title: "Auto-scrapes daily",
              desc: "Pulls fresh jobs from LinkedIn, Indeed & Glassdoor based on your target roles and locations.",
            },
            {
              icon: Star,
              title: "AI match scoring",
              desc: "Gemini scores every listing against your resume — only strong matches move forward.",
            },
            {
              icon: Bot,
              title: "Tailored in seconds",
              desc: "Custom resume bullets and a cover letter generated for each qualifying job automatically.",
            },
            {
              icon: CheckCircle,
              title: "You review & approve",
              desc: "Nothing goes out without your sign-off. Approve, skip, or mark as applied from the dashboard.",
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
  );
}
