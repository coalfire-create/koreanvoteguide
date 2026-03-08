import { useSchedulerStatus } from "@/lib/api-data";
import { Clock } from "lucide-react";

export function LastUpdated() {
  const { status, isLoading } = useSchedulerStatus();

  if (isLoading || !status?.lastRun) return null;

  const lastRun = new Date(status.lastRun);
  const timeStr = lastRun.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = lastRun.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="text-last-updated">
      <Clock className="w-3 h-3" />
      <span>마지막 업데이트: {dateStr} {timeStr}</span>
      {status.success === false && (
        <span className="text-amber-500 dark:text-amber-400 ml-1">(갱신 실패)</span>
      )}
    </div>
  );
}
