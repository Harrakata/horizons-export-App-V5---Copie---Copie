import { cn } from '@/lib/utils';

/**
 * Bloc de chargement à afficher pendant les fetchs.
 * Évite les layout shifts en gardant la place exacte du contenu final.
 *
 * @example
 * {isLoading ? <Skeleton className="h-8 w-32" /> : <span>{value}</span>}
 */
export const Skeleton = ({ className, ...props }) => (
  <div
    className={cn('animate-pulse rounded-md bg-muted/70', className)}
    {...props}
  />
);

/** Skeleton pour une ligne de tableau */
export const SkeletonRow = ({ cols = 5, className }) => (
  <tr className={className}>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="p-2">
        <Skeleton className="h-4 w-full" />
      </td>
    ))}
  </tr>
);

/** Skeleton pour une carte KPI */
export const SkeletonCard = ({ className }) => (
  <div className={cn('space-y-3 rounded-xl border border-border p-4', className)}>
    <Skeleton className="h-4 w-24" />
    <Skeleton className="h-8 w-32" />
    <Skeleton className="h-3 w-full" />
  </div>
);

export default Skeleton;
