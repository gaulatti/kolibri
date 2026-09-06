import { PageHeader } from "~/bleecker";
import { RouterButton } from "../components/router-button";

export function PageHeading({
  title,
  description,
  action,
  breadcrumbs,
}: {
  title: string;
  description?: string;
  action?: { label: string; to: string };
  breadcrumbs?: React.ReactNode;
}) {
  return (
    <PageHeader
      className="border-b border-sand/25 pb-8 dark:border-white/[0.08]"
      title={title}
      description={description}
      breadcrumbs={breadcrumbs}
      actions={
        action ? (
          <RouterButton to={action.to}>{action.label}</RouterButton>
        ) : undefined
      }
    />
  );
}
