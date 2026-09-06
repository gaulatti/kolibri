import type {
  GenerationHistoryFilters,
  GenerationStatus,
} from "../api/generations";

const STATUSES: GenerationStatus[] = [
  "pending",
  "running",
  "succeeded",
  "failed",
];

export type HistoryFilterFormValue = {
  status: "" | GenerationStatus;
  startDate: string;
  endDate: string;
  pageSize: string;
  sortDirection: "asc" | "desc";
};

export type HistoryFilterErrors = Partial<
  Record<keyof HistoryFilterFormValue, string>
>;

export function filtersFromSearchParams(
  searchParams: URLSearchParams,
): GenerationHistoryFilters {
  const rawStatus = searchParams.get("status");
  const rawPage = Number(searchParams.get("page"));
  const rawPageSize = Number(searchParams.get("pageSize"));
  return {
    designSystemId: searchParams.get("designSystemId")?.trim() || undefined,
    status: STATUSES.includes(rawStatus as GenerationStatus)
      ? (rawStatus as GenerationStatus)
      : undefined,
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    pageSize:
      Number.isInteger(rawPageSize) && rawPageSize > 0 && rawPageSize <= 100
        ? rawPageSize
        : 25,
    sortDirection:
      searchParams.get("sortDirection") === "asc" ? "asc" : "desc",
  };
}

export function formValueFromFilters(
  filters: GenerationHistoryFilters,
): HistoryFilterFormValue {
  return {
    status: filters.status || "",
    startDate: filters.startDate || "",
    endDate: filters.endDate || "",
    pageSize: String(filters.pageSize || 25),
    sortDirection: filters.sortDirection === "asc" ? "asc" : "desc",
  };
}

export function validateHistoryFilters(
  value: HistoryFilterFormValue,
): HistoryFilterErrors {
  const errors: HistoryFilterErrors = {};
  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    errors.endDate = "End date must be on or after the start date.";
  }
  return errors;
}

export function searchParamsFromForm(
  value: HistoryFilterFormValue,
): URLSearchParams {
  const params = new URLSearchParams();
  if (value.status) params.set("status", value.status);
  if (value.startDate) params.set("startDate", value.startDate);
  if (value.endDate) params.set("endDate", value.endDate);
  if (value.pageSize !== "25") params.set("pageSize", value.pageSize);
  if (value.sortDirection === "asc") params.set("sortDirection", "asc");
  return params;
}

export function withPage(
  searchParams: URLSearchParams,
  page: number,
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  if (page <= 1) next.delete("page");
  else next.set("page", String(page));
  return next;
}
