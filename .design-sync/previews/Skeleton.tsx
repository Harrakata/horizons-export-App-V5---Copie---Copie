import { Skeleton, SkeletonCard } from 'pmu-mali-gestion';

export function Lignes() {
  return (
    <div className="w-[320px] space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

export function Carte() {
  return (
    <div className="w-[260px]">
      <SkeletonCard />
    </div>
  );
}
