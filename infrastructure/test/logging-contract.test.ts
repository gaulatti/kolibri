import * as fs from "node:fs";
import * as path from "node:path";

const repositoryRoot = path.resolve(__dirname, "../..");
const read = (relativePath: string): string =>
  fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");

describe("backend deployment logging", () => {
  const githubWorkflow = read(".github/workflows/backend-deploy.yml");
  const gitlabWorkflow = read(".gitlab-ci.yml");

  it.each([
    ["GitHub", githubWorkflow],
    ["GitLab", gitlabWorkflow],
  ])("uses bounded host-local logs in %s", (_name, workflow) => {
    expect(workflow).toContain("--log-driver=local");
    expect(workflow).toContain("--log-opt max-size=10m");
    expect(workflow).toContain("--log-opt max-file=3");
    expect(workflow).not.toContain("awslogs");
    expect(workflow).not.toContain("BACKEND_LOG_GROUP");
  });

  it("deploys from GitHub only on main for backend changes or by hand, and keeps GitLab manual", () => {
    // gaulatti/kolibri#19: the Helix pattern deploys on a push to main that touches the backend
    // (or the workflow itself), and can also be started by hand.
    expect(githubWorkflow).toMatch(
      /on:\s*\n\s+push:\s*\n\s+branches: \[main\]\s*\n\s+paths: \['backend\/\*\*', '\.github\/workflows\/backend-deploy\.yml'\]\s*\n\s+workflow_dispatch:/,
    );
    expect(githubWorkflow).not.toMatch(/pull_request/);
    expect(gitlabWorkflow.match(/when: manual/g)).toHaveLength(6);
  });
});
