import {
  Button,
  CollectionFilters,
  Field,
  Select,
} from "~/bleecker";
import type {
  HistoryFilterErrors,
  HistoryFilterFormValue,
} from "./history-filters";

export function HistoryFilterForm({
  value,
  errors,
  onApply,
  onReset,
}: {
  value: HistoryFilterFormValue;
  errors: HistoryFilterErrors;
  onApply: (value: HistoryFilterFormValue) => void;
  onReset: () => void;
}) {
  const currentFilters: Record<string, string> = {};
  if (value.status) currentFilters.status = value.status;
  if (value.startDate) currentFilters.startDate = value.startDate;
  if (value.endDate) currentFilters.endDate = value.endDate;

  return (
    <div className="space-y-4">
      <CollectionFilters
        currentFilters={currentFilters}
        currentSort={{ field: "startedAt", order: value.sortDirection }}
        defaultExpanded={Object.keys(currentFilters).length > 0}
        filterOptions={[
          {
            field: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "pending", label: "Pending" },
              { value: "running", label: "Running" },
              { value: "succeeded", label: "Succeeded" },
              { value: "failed", label: "Failed" },
            ],
          },
          { field: "startDate", label: "Started after", type: "date" },
          { field: "endDate", label: "Started before", type: "date" },
        ]}
        sortOptions={[{ field: "startedAt", label: "Start time" }]}
        onFilterChange={(filters) =>
          onApply({
            ...value,
            status: (filters.status || "") as HistoryFilterFormValue["status"],
            startDate: String(filters.startDate || ""),
            endDate: String(filters.endDate || ""),
          })
        }
        onSortChange={(sort) =>
          onApply({ ...value, sortDirection: sort.order })
        }
      />

      {errors.endDate ? (
        <p className="text-sm text-terracotta" role="alert">
          {errors.endDate}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 border-b border-sand/20 pb-6 dark:border-white/[0.07] sm:flex-row sm:items-end sm:justify-between">
        <Field className="w-full sm:w-44" label="Rows per page">
          <Select
            value={value.pageSize}
            onChange={(pageSize) => onApply({ ...value, pageSize })}
            options={["10", "25", "50", "100"].map((size) => ({
              value: size,
              label: `${size} rows`,
            }))}
          />
        </Field>
        <Button variant="ghost" type="button" onClick={onReset}>
          Reset view
        </Button>
      </div>
    </div>
  );
}
