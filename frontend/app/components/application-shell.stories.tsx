import {
  AppShell,
  Avatar,
  Button,
  Card,
  DashboardGrid,
  DashboardSection,
  Empty,
  Header,
  PageHeader,
  StatCard,
  ThemeProvider,
  ThemeToggle,
} from "~/bleecker";
import type { Meta, StoryObj } from "@storybook/react-vite";

function ApplicationShell() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="kolibri-story-theme">
      <AppShell
        className="antialiased"
        offsetHeader
        header={
          <Header
            brand={{ href: "#systems", name: "kolibri", logoAlt: "kolibri" }}
            navigation={[
              { href: "#home", label: "Home" },
              { href: "#systems", label: "Design Systems" },
            ]}
            actions={
              <>
                <Avatar fallback="Javier Godoy" size="sm" />
                <ThemeToggle aria-label="Change color theme" />
                <Button variant="ghost" size="sm">
                  Sign out
                </Button>
              </>
            }
          />
        }
      >
        <div className="container mx-auto max-w-7xl">
          <div className="space-y-10 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-14">
            <DashboardSection className="space-y-10">
              <PageHeader
                className="border-b border-sand/25 pb-8 dark:border-white/[0.08]"
                title="Design Systems"
                description="Manage package sources, configuration, and generation history."
                actions={<Button>New design system</Button>}
              />
              <DashboardGrid columns={3}>
                <StatCard title="Design Systems" value={2} />
                <StatCard title="Successful runs" value={18} />
                <StatCard title="Available artifacts" value={14} />
              </DashboardGrid>
              <Card variant="outlined" padding="lg">
                <h2>Primary Design System</h2>
                <p>Shared components for the main product suite.</p>
              </Card>
              <Empty
                title="Everything is organized"
                description="New design systems will appear here."
              />
            </DashboardSection>
          </div>
        </div>
      </AppShell>
    </ThemeProvider>
  );
}

const meta = {
  title: "kolibri/Application shell",
  component: ApplicationShell,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ApplicationShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
