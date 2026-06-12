import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutes
const LAST_ACTIVITY_KEY = "jobfit_last_activity";
const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart"];

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
  getToken: async () => null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Auto sign-out after a period of inactivity. The timestamp lives in
  // localStorage so activity in any tab keeps all tabs signed in, and a
  // stale tab opened after the limit signs out immediately.
  const hasSession = !!session;
  useEffect(() => {
    if (!hasSession) return;

    const recordActivity = () => {
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    };

    const checkInactivity = () => {
      const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) ?? Date.now());
      if (Date.now() - last >= INACTIVITY_LIMIT_MS) {
        supabase.auth.signOut();
      }
    };

    recordActivity();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, recordActivity));
    document.addEventListener("visibilitychange", checkInactivity);
    const interval = setInterval(checkInactivity, 60 * 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, recordActivity));
      document.removeEventListener("visibilitychange", checkInactivity);
      clearInterval(interval);
    };
  }, [hasSession]);

  const signOut = async () => {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    await supabase.auth.signOut();
  };

  // Always fetch the current session so Supabase can silently refresh an
  // expired token before we use it — avoids 401s after 1+ hour sessions.
  const getToken = async (): Promise<string | null> => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    return currentSession?.access_token ?? null;
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
