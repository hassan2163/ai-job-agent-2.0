import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Sparkles, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set New Password — JobFit AI" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);

  // Supabase puts the recovery token in the URL hash.
  // onAuthStateChange fires PASSWORD_RECOVERY once the token is consumed.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    // Also check if we already have a session (token already exchanged)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else {
        // Give Supabase a moment to process the hash
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: d }) => {
            if (!d.session) setInvalid(true);
          });
        }, 2000);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated! Signing you in…");
      setTimeout(() => navigate({ to: "/dashboard" }), 1500);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Link to="/" className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-brand shadow-glow">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </Link>
          <div className="text-center">
            <h1 className="font-display text-2xl font-semibold text-foreground">Set new password</h1>
            <p className="mt-1 text-sm text-muted-foreground">Choose a strong password for your account</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-gradient-card p-6 shadow-card">
          {invalid ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                This reset link is invalid or has expired.
              </p>
              <Button asChild className="w-full bg-gradient-brand text-primary-foreground shadow-glow">
                <Link to="/forgot-password">Request a new link</Link>
              </Button>
            </div>
          ) : !ready ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm Password</Label>
                <Input
                  id="confirm"
                  type={showPassword ? "text" : "password"}
                  placeholder="Repeat your password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-brand text-primary-foreground shadow-glow hover:opacity-95"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
