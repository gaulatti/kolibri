import { Pagination as BleeckerPagination } from "~/bleecker";
import type { Pagination } from "../api/generations";

export function PaginationControls({
  pagination,
  onPage,
}: {
  pagination: Pagination;
  onPage: (page: number) => void;
}) {
  if (pagination.totalItems === 0) return null;
  const firstItem = (pagination.page - 1) * pagination.pageSize + 1;
  const lastItem = Math.min(
    pagination.page * pagination.pageSize,
    pagination.totalItems,
  );

  return (
    <div className="flex flex-col items-center justify-between gap-4 border-t border-sand/20 pt-6 dark:border-white/[0.07] sm:flex-row">
      <p className="font-secondary text-sm text-text-secondary">
        Showing{" "}
        <strong className="font-medium tabular-nums text-text-primary">
          {firstItem.toLocaleString()}–{lastItem.toLocaleString()}
        </strong>{" "}
        of{" "}
        <strong className="font-medium tabular-nums text-text-primary">
          {pagination.totalItems.toLocaleString()}
        </strong>
      </p>
      <BleeckerPagination
        className="mt-0"
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        hasPrevPage={pagination.hasPreviousPage}
        hasNextPage={pagination.hasNextPage}
        onPageChange={onPage}
      />
    </div>
  );
}
