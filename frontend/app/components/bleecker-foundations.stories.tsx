import {
  Button,
  Card,
  DashboardGrid,
  DashboardSection,
  Empty,
  Field,
  Input,
  LoadingSpinner,
  StatusBadge,
  Textarea,
} from "~/bleecker";
import type { Meta, StoryObj } from "@storybook/react-vite";

function BleeckerFoundations() {
  return (
    <DashboardSection
      title="kolibri controls"
      description="Published Bleecker primitives used by the application."
    >
      <StatusBadge variant="live" label="Ready" />
      <Card variant="outlined" padding="lg">
        <DashboardGrid columns={2}>
          <Field label="Design-system name" required>
            <Input id="story-name" defaultValue="Primary Design System" />
          </Field>
          <Field label="Description" optional>
            <Textarea
              id="story-description"
              defaultValue="Shared product components."
            />
          </Field>
        </DashboardGrid>
        <div className="mt-6 flex justify-end gap-3 border-t border-sand/20 pt-6">
          <Button variant="ghost">Cancel</Button>
          <Button>Save design system</Button>
        </div>
      </Card>
      <Empty
        title="No generation runs found"
        description="Start a generation and its saved progress will appear here."
        action={<Button>Start generation</Button>}
      />
      <LoadingSpinner size="sm" />
    </DashboardSection>
  );
}

const meta = {
  title: "kolibri/Bleecker foundations",
  component: BleeckerFoundations,
} satisfies Meta<typeof BleeckerFoundations>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Foundations: Story = {};
