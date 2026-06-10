import { DashboardStats } from "@/lib/dashboard-api";
import { Briefcase, Clock, CheckCircle, Send, XCircle } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
  active?: boolean;
}

function StatCard({ label, value, icon, color, onClick, active }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col gap-3 rounded-xl border p-5 text-left transition-all hover:shadow-md ${
        active
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card hover:border-primary/40"
      } ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className={`rounded-lg p-2 ${color}`}>{icon}</span>
      </div>
      <span className="text-3xl font-bold text-foreground">{value ?? 0}</span>
    </button>
  );
}

interface StatsBarProps {
  stats: DashboardStats;
  activeFilter: string | null;
  onFilter: (status: string | null) => void;
}

export function StatsBar({ stats, activeFilter, onFilter }: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard
        label="Total"
        value={stats.total}
        icon={<Briefcase className="h-4 w-4" />}
        color="bg-muted text-muted-foreground"
        onClick={() => onFilter(null)}
        active={activeFilter === null}
      />
      <StatCard
        label="Pending Review"
        value={stats.pending}
        icon={<Clock className="h-4 w-4" />}
        color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
        onClick={() => onFilter("pending_review")}
        active={activeFilter === "pending_review"}
      />
      <StatCard
        label="Approved"
        value={stats.approved}
        icon={<CheckCircle className="h-4 w-4" />}
        color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
        onClick={() => onFilter("approved")}
        active={activeFilter === "approved"}
      />
      <StatCard
        label="Applied"
        value={stats.applied}
        icon={<Send className="h-4 w-4" />}
        color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
        onClick={() => onFilter("applied")}
        active={activeFilter === "applied"}
      />
      <StatCard
        label="Skipped"
        value={stats.skipped}
        icon={<XCircle className="h-4 w-4" />}
        color="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
        onClick={() => onFilter("skipped")}
        active={activeFilter === "skipped"}
      />
    </div>
  );
}
