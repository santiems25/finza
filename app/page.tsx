import { Suspense } from "react";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { Skeleton } from "@/components/ui/skeleton";
import { FinzaLogo } from "@/components/layout/finza-logo";

export default function DashboardPage() {
  return (
    <div className="px-4 pt-6 pb-2">
      <div className="mb-6">
        <FinzaLogo size="md" />
      </div>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 rounded-xl" />
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}
