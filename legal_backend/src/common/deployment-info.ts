import { ConfigService } from '@nestjs/config';

export interface DeploymentInfo {
  live: boolean;
  probe: string;
  gitCommit: string;
  gitCommitShort: string;
  gitBranch: string;
  builtAt: string;
  image: string;
  ci: {
    pipeline: string;
    workflow: string;
    runId: string;
  };
  verifyHint: string;
}

export function getDeploymentInfo(
  configService: ConfigService,
): DeploymentInfo {
  const gitCommit = configService.get<string>('GIT_COMMIT_SHA', 'unknown');
  const gitBranch = configService.get<string>('GIT_BRANCH', 'unknown');
  const builtAt = configService.get<string>('BUILD_TIME', 'unknown');
  const workflow = configService.get<string>('CI_WORKFLOW', 'local');
  const runId = configService.get<string>('CI_RUN_ID', 'local');
  const probe = configService.get<string>(
    'DEPLOY_PROBE_MARKER',
    'local-dev',
  );
  const imageRepo = configService.get<string>(
    'DOCKER_IMAGE_REPO',
    'ayienda/legal-byodaflow',
  );

  const isProductionBuild =
    gitCommit !== 'unknown' &&
    builtAt !== 'unknown' &&
    workflow !== 'local';

  return {
    live: true,
    probe,
    gitCommit,
    gitCommitShort: gitCommit === 'unknown' ? 'unknown' : gitCommit.slice(0, 7),
    gitBranch,
    builtAt,
    image: `${imageRepo}:${gitCommit === 'unknown' ? 'latest' : gitCommit}`,
    ci: {
      pipeline: isProductionBuild ? 'github-actions' : 'local',
      workflow,
      runId,
    },
    verifyHint:
      'After push to main, curl this URL and confirm gitCommitShort + probe match the latest CI run.',
  };
}
