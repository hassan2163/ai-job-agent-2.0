import { Sparkles, LayoutDashboard, UserCircle, LogOut, LogIn } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export function Header() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out.");
    window.location.href = "/";
  };

  return (
    <header className="sticky top-0 z-40 glass border-b border-border/60">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand shadow-glow">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display text-sm font-semibold">JobFit AI</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Application Assistant
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </Link>
              <Link
                to="/profile"
                className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <UserCircle className="h-4 w-4" /> Profile
              </Link>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </>
          ) : (
            <>
              <a href="#features" className="hover:text-foreground transition-colors">
                How it works
              </a>
              <a href="#app" className="hover:text-foreground transition-colors">
                Analyze
              </a>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <LogIn className="h-4 w-4" /> Sign In
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Get Started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
