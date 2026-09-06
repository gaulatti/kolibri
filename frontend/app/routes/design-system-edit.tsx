import {
  AlertDialog,
  Button,
  Card,
  DashboardSection,
  ErrorState,
} from "~/bleecker";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ApiError } from "../api/api-client";
import { designSystemsApi, type DesignSystem } from "../api/design-systems";
import { LoadingState } from "../components/loading-state";
import { AppBreadcrumb } from "../components/app-breadcrumb";
import { RouterButton } from "../components/router-button";
import { DesignSystemForm } from "../design-systems/design-system-form";
import { PageHeading } from "../design-systems/page-heading";
import type { Route } from "./+types/design-system-edit";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Edit design system | kolibri" }];
}

export default function EditDesignSystem({ params }: Route.ComponentProps) {
  const [designSystem, setDesignSystem] = useState<DesignSystem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    designSystemsApi
      .get(params.designSystemId)
      .then((result) => {
        if (active) setDesignSystem(result);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof ApiError
              ? cause.message
              : "This design system could not be loaded.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [params.designSystemId]);

  if (error) {
    return (
      <DashboardSection>
        <AppBreadcrumb
          items={[
            { href: "/", label: "Home" },
            { href: "/design-systems", label: "Design Systems" },
            {
              href: `/design-systems/${params.designSystemId}`,
              label: "Design system",
            },
            {
              href: `/design-systems/${params.designSystemId}/edit`,
              label: "Edit",
            },
          ]}
        />
        <ErrorState title="Design system unavailable" description={error} />
        <RouterButton variant="secondary" to="/design-systems">
          Return to Design Systems
        </RouterButton>
      </DashboardSection>
    );
  }

  if (!designSystem)
    return (
      <DashboardSection>
        <AppBreadcrumb
          items={[
            { href: "/", label: "Home" },
            { href: "/design-systems", label: "Design Systems" },
            {
              href: `/design-systems/${params.designSystemId}`,
              label: "Design system",
            },
            {
              href: `/design-systems/${params.designSystemId}/edit`,
              label: "Edit",
            },
          ]}
        />
        <LoadingState label="Loading design system…" />
      </DashboardSection>
    );
  const designSystemId = designSystem.id;

  async function deleteDesignSystem() {
    setDeletePending(true);
    setDeleteError(null);
    try {
      await designSystemsApi.delete(designSystemId);
      navigate("/design-systems", {
        replace: true,
        state: { notice: "Design system deleted." },
      });
    } catch (cause) {
      setDeleteError(
        cause instanceof ApiError
          ? cause.message
          : "The design system could not be deleted.",
      );
      setDeletePending(false);
    }
  }

  return (
    <DashboardSection className="space-y-10">
      <PageHeading
        title={`Edit ${designSystem.name}`}
        description="Update its identity and component contract without changing runtime credentials."
        breadcrumbs={
          <AppBreadcrumb
            items={[
              { href: "/", label: "Home" },
              { href: "/design-systems", label: "Design Systems" },
              {
                href: `/design-systems/${designSystem.id}`,
                label: designSystem.name,
              },
              {
                href: `/design-systems/${designSystem.id}/edit`,
                label: "Edit",
              },
            ]}
          />
        }
      />
      <DesignSystemForm
        initialValue={{
          name: designSystem.name,
          description: designSystem.description,
          generationContract: designSystem.generationContract,
        }}
        submitLabel="Save changes"
        onSubmit={async (input) => {
          await designSystemsApi.update(designSystem.id, input);
          navigate(`/design-systems/${designSystem.id}`, {
            replace: true,
            state: { notice: "Design system updated." },
          });
        }}
      />
      <Card
        className="max-w-4xl border-terracotta/25 dark:border-terracotta/30"
        variant="subtle"
      >
        <DashboardSection
          title="Delete design system"
          description="Permanently remove this design system and its generation history."
          action={
            <Button
              variant="destructive"
              type="button"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete design system
            </Button>
          }
        >
          {deleteError ? (
            <ErrorState title="Deletion failed" description={deleteError} />
          ) : null}
        </DashboardSection>
      </Card>
      <AlertDialog
        isOpen={confirmingDelete}
        title={`Delete ${designSystem.name}?`}
        description="This removes the design system and its generation history."
        variant="destructive"
        confirmLabel="Delete"
        confirmLoading={deletePending}
        onConfirm={() => void deleteDesignSystem()}
        onCancel={() => {
          if (deletePending) return;
          setConfirmingDelete(false);
          setDeleteError(null);
        }}
      />
    </DashboardSection>
  );
}
