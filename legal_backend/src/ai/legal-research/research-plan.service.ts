import { Injectable } from '@nestjs/common';
import type {
  ExecutableResearchPlan,
  NormalizedResearchRequest,
  PlannedQuery,
  QueryFamily,
  ResearchCapability,
  ResearchCapabilitySnapshot,
  ResearchIssue,
  ResearchTaskProfile,
} from './research-planning.types';

@Injectable()
export class ResearchPlanService {
  build(
    request: NormalizedResearchRequest,
    task: ResearchTaskProfile,
    capabilities: ResearchCapabilitySnapshot,
  ): ExecutableResearchPlan {
    const issues = this.buildIssues(request, task);
    const queries = this.buildQueries(request, task, issues);
    const requiredCapabilities =
      task.evidenceBundle?.requiredCapabilities ?? task.requiredCapabilities;
    const missing = requiredCapabilities.filter(
      (capability) => !capabilities.availableCapabilities.includes(capability),
    );
    const blockers = missing.map(
      (capability) => `Required capability ${capability} is unavailable or unverified.`,
    );

    const contraryChecks = issues
      .filter((issue) => issue.materiality !== 'BACKGROUND')
      .map((issue) => ({
        id: `contrary-${issue.id}`,
        issueId: issue.id,
        queryIds: queries
          .filter(
            (query) =>
              query.issueId === issue.id &&
              (query.family === 'NEGATIVE' || query.family === 'CONTRARY_AUTHORITY'),
          )
          .map((query) => query.id),
        required:
          task.evidenceBundle?.requireContraryCheck ??
          (task.kind !== 'CITATION_VERIFICATION' &&
            task.kind !== 'SECTION_LOOKUP' &&
            task.kind !== 'CASE_SURVEY'),
        complete: false,
      }));

    return {
      version: 1,
      request,
      task,
      capabilities,
      issues,
      queries,
      stoppingConditions: this.buildStoppingConditions(task, issues, missing),
      conflictChecks: issues.map((issue) => ({
        id: `conflict-${issue.id}`,
        issueId: issue.id,
        compareBy: ['HOLDING', 'COURT', 'DATE', 'JURISDICTION', 'STATUTORY_VERSION'],
        required:
          task.evidenceBundle?.requireContraryCheck ??
          (task.kind !== 'CITATION_VERIFICATION' &&
            task.kind !== 'SECTION_LOOKUP' &&
            task.kind !== 'CASE_SURVEY'),
      })),
      contraryChecks,
      executable: blockers.length === 0,
      blockers,
    };
  }

  private buildIssues(
    request: NormalizedResearchRequest,
    task: ResearchTaskProfile,
  ): ResearchIssue[] {
    if (task.kind === 'CITATION_VERIFICATION' || task.kind === 'CASE_LOOKUP') {
      return [
        this.issue(
          request,
          'citation',
          `Resolve and verify the requested citation: ${request.objective}`,
          [],
          'DISPOSITIVE',
          ['CASE_LAW'],
        ),
      ];
    }
    if (task.kind === 'SECTION_LOOKUP') {
      return [
        this.issue(
          request,
          'section',
          `Locate the exact operative statutory text requested: ${request.objective}`,
          [],
          'DISPOSITIVE',
          ['STATUTES'],
        ),
      ];
    }
    if (task.kind === 'CASE_SURVEY') {
      return [
        {
          ...this.issue(
            request,
            'case-discovery',
            `Which judgments directly address the requested subject, and how closely do they match it?`,
            [],
            'DISPOSITIVE',
            ['CASE_LAW'],
          ),
          contraryPositionRequired: false,
        },
        {
          ...this.issue(
            request,
            'case-outcomes',
            `What material facts, issue, supported holding, and disposition can be stated for each admitted judgment?`,
            ['case-discovery'],
            'MATERIAL',
            ['CASE_LAW'],
          ),
          contraryPositionRequired: false,
        },
      ];
    }
    if (task.kind === 'CASE_ANALYSIS' || task.kind === 'CASE_COMPARISON') {
      return [
        this.issue(request, 'identity', `Verify the identity and full text of each requested case.`, [], 'DISPOSITIVE', ['CASE_LAW']),
        this.issue(request, 'holding', `What issue, holding, ratio, and disposition does each admitted judgment establish?`, ['identity'], 'DISPOSITIVE', ['CASE_LAW']),
        this.issue(request, 'treatment', `What later treatment, bench status, and current precedential weight applies?`, ['holding'], 'MATERIAL', ['TREATMENT']),
        this.issue(request, 'contrary', `What contrary or distinguishing authority limits the stated position?`, ['holding'], 'MATERIAL', ['CASE_LAW', 'TREATMENT']),
      ];
    }

    const foundationQuestion =
      task.kind === 'PROCEDURE'
        ? `What current rules govern the requested procedure in ${this.place(request)}?`
        : `What controlling statutory and doctrinal framework governs: ${request.objective}?`;
    const issues: ResearchIssue[] = [
      this.issue(request, 'law', foundationQuestion, [], 'DISPOSITIVE', ['STATUTES']),
      this.issue(
        request,
        'authority',
        `How have controlling and persuasive authorities treated the issue?`,
        ['law'],
        'MATERIAL',
        ['CASE_LAW'],
      ),
    ];

    if (task.kind === 'MATTER_OPINION') {
      issues.push(
        this.issue(
          request,
          'application',
          `How does the governing law apply to the supplied facts and requested outcome?`,
          ['law', 'authority'],
          'MATERIAL',
          ['CASE_LAW', 'STATUTES'],
        ),
      );
    }

    issues.push(
      this.issue(
        request,
        'contrary',
        'What adverse, limiting, distinguishing, repealing, or overruling authority must be addressed?',
        ['authority'],
        task.kind === 'ADVERSE_AUTHORITY' ? 'DISPOSITIVE' : 'BACKGROUND',
        ['CASE_LAW', 'TREATMENT'],
      ),
    );
    return issues;
  }

  private issue(
    request: NormalizedResearchRequest,
    id: string,
    question: string,
    dependencies: string[],
    materiality: ResearchIssue['materiality'],
    requiredCapabilities: ResearchCapability[],
  ): ResearchIssue {
    return {
      id,
      question,
      proposition: question,
      propositionType:
        id === 'section'
          ? 'STATUTORY_TEXT'
          : id === 'holding' || id === 'identity' || id === 'authority'
            ? 'CASE_HOLDING'
            : id === 'application'
              ? 'APPLICATION'
              : id === 'law'
                ? 'LEGAL_RULE'
                : 'CONCLUSION',
      dependencies,
      dependsOn: [...dependencies],
      materiality,
      status: 'PLANNED',
      provesWith: [
        id === 'section'
          ? 'Exact operative primary text and commencement metadata'
          : 'An admitted primary authority passage that entails the proposition',
      ],
      disprovesWith: [
        'Controlling contrary authority, an applicable exception, adverse treatment, or incompatible operative text',
      ],
      minimumAuthority:
        id === 'section' || id === 'law'
          ? 'Official operative statutory text'
          : 'Full judgment from a controlling or admissible reported source',
      temporalCutoff: request.asOfDate,
      jurisdiction: request.jurisdiction ?? request.countryCode ?? 'UNKNOWN',
      forum: request.courtLevel,
      permittedSourceClasses: ['PRIMARY', 'OFFICIAL', 'REPORTED'],
      expectedOutput: question,
      contraryPositionRequired: id !== 'citation' && id !== 'section',
      requiredCapabilities,
    };
  }

  private buildQueries(
    request: NormalizedResearchRequest,
    task: ResearchTaskProfile,
    issues: ResearchIssue[],
  ): PlannedQuery[] {
    if (task.kind === 'CASE_SURVEY') {
      const subject = this.compactLegalIssue(request.objective);
      const discovery = issues.find((issue) => issue.id === 'case-discovery') ?? issues[0];
      const outcomes = issues.find((issue) => issue.id === 'case-outcomes') ?? discovery;
      return [
        this.query(discovery.id, 'POSITIVE', subject, 'Find judgments matching the requested subject pair', 1, ['CASE_LAW']),
        this.query(discovery.id, 'DOCTRINAL_SYNONYM', `${subject} dispute enforcement`, 'Search compact doctrinal variants', 1, ['CASE_LAW']),
        this.query(outcomes.id, 'PROPOSITION', `${subject} holding disposition outcome`, 'Find supported holding and disposition passages', 1, ['CASE_LAW']),
        this.query(discovery.id, 'COURT_SPECIFIC', `${subject} ${request.courtLevel ?? request.jurisdiction ?? request.countryCode ?? ''}`, 'Search the requested jurisdiction and court', 2, ['CASE_LAW']),
        this.query(outcomes.id, 'NEGATIVE_FORMULATION', `${subject} refused invalid unenforceable dismissed`, 'Find disputed and unsuccessful outcomes', 2, ['CASE_LAW']),
        this.query(discovery.id, 'CONTRARY_AUTHORITY', `${subject} distinguished contrary`, 'Find limiting or distinguishing judgments', 3, ['CASE_LAW']),
      ];
    }
    const queries: PlannedQuery[] = [];
    for (const issue of issues) {
      const base = `${request.objective} ${issue.question}`;
      if (issue.id === 'citation' || issue.id === 'identity') {
        queries.push(this.query(issue.id, 'CITATION', base, 'Resolve the named authority and citation', 1, ['CASE_LAW']));
        continue;
      }
      if (issue.id === 'law' || issue.id === 'section') {
        queries.push(this.query(issue.id, 'STATUTORY_TEXT', `${base} official text in force ${request.asOfDate}`, 'Find controlling primary text', 1, ['STATUTES']));
      } else {
        queries.push(this.query(issue.id, 'POSITIVE', `${base} supporting binding authority`, 'Find authority supporting the proposition', 1, ['CASE_LAW']));
      }
      queries.push(this.query(issue.id, 'NEGATIVE', `${base} rejected denied not applicable`, 'Test the proposition against negative outcomes', 2, ['CASE_LAW']));
      queries.push(this.query(issue.id, 'CONTRARY_AUTHORITY', `${base} contrary adverse distinguished limited`, 'Find adverse or limiting authority', 2, ['CASE_LAW']));
      queries.push(this.query(issue.id, 'TREATMENT', `${base} overruled reversed superseded good law`, 'Check subsequent treatment', 3, ['TREATMENT']));
      queries.push(this.query(issue.id, 'PROPOSITION', `"${issue.proposition}"`, 'Search the exact legal proposition', 2, ['CASE_LAW']));
      queries.push(this.query(issue.id, 'DOCTRINAL_SYNONYM', `${request.objective} alternate doctrine terminology`, 'Search doctrinal synonyms and alternate formulations', 3, ['CASE_LAW']));
      queries.push(this.query(issue.id, 'NEGATIVE_FORMULATION', `${issue.question} exception exclusion bar rejected`, 'Search rejection, exceptions, and procedural bars', 2, ['CASE_LAW']));
      queries.push(this.query(issue.id, 'COURT_SPECIFIC', `${base} ${request.courtLevel ?? request.jurisdiction ?? request.countryCode ?? ''}`, 'Search the controlling forum specifically', 2, ['CASE_LAW']));
      queries.push(this.query(issue.id, 'LATER_TREATMENT', `${base} followed distinguished doubted overruled later treatment`, 'Find later treatment and limiting decisions', 2, ['TREATMENT']));
      queries.push(this.query(issue.id, 'CITED_BY', `${base} cited by subsequent cases`, 'Traverse later citing authorities', 3, ['TREATMENT']));
      queries.push(this.query(issue.id, 'CITING', `${base} authorities relied upon`, 'Traverse authorities relied upon by the decision', 3, ['CASE_LAW']));
    }

    for (const citation of request.citedAuthorities) {
      const issue = issues.find((candidate) => candidate.id === 'citation' || candidate.id === 'identity') ?? issues[0];
      queries.push(this.query(issue.id, 'EXACT_CITATION', `"${citation}"`, 'Resolve the exact user-supplied citation', 1, ['CASE_LAW']));
    }
    for (const statute of request.statuteReferences) {
      const issue = issues.find((candidate) => candidate.id === 'section' || candidate.id === 'law') ?? issues[0];
      queries.push(this.query(issue.id, 'STATUTE_SECTION', `"${statute}" official operative text`, 'Locate the exact act and section version', 1, ['STATUTES']));
    }
    const partyStyle = request.objective.match(
      /\b([A-Z][A-Za-z.&' -]{2,50})\s+(?:v\.?|versus)\s+([A-Z][A-Za-z.&' -]{2,50})\b/,
    );
    if (partyStyle) {
      const issue = issues.find((candidate) => candidate.id === 'citation' || candidate.id === 'identity') ?? issues[0];
      queries.push(this.query(issue.id, 'PARTY_NAME', `"${partyStyle[1].trim()}" "${partyStyle[2].trim()}"`, 'Search party-name and style variants', 1, ['CASE_LAW']));
    }
    if (/[\u0900-\u0D7F]/u.test(request.objective)) {
      queries.push(this.query(issues[0].id, 'LOCAL_LANGUAGE', request.objective, 'Preserve supported local-language terminology', 2, task.requiredCapabilities));
    }

    if (task.kind === 'CURRENT_LAW') {
      const issue = issues[0];
      queries.push(this.query(issue.id, 'CURRENT_LAW', `${request.objective} latest amendment decision as of ${request.asOfDate}`, 'Confirm the law is current', 1, ['CURRENT_LAW']));
    }
    if (task.kind === 'PROCEDURE') {
      const issue = issues[0];
      queries.push(this.query(issue.id, 'PROCEDURE', `${request.objective} rules forms limitation forum`, 'Resolve procedural requirements', 1, ['STATUTES']));
    }
    return queries;
  }

  private compactLegalIssue(value: string): string {
    return value
      .replace(/\b(?:what|which|are|were|where|how|in|under|law|indian|india|similar|cases?|judgments?|key|outcomes?|involving|involved)\b/gi, ' ')
      .replace(/[?.,;:]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240);
  }

  private query(
    issueId: string,
    family: QueryFamily,
    query: string,
    purpose: string,
    priority: number,
    requiredCapabilities: ResearchCapability[],
  ): PlannedQuery {
    return {
      id: `${issueId}-${family.toLowerCase()}`,
      issueId,
      family,
      query: query.replace(/\s+/g, ' ').trim(),
      purpose,
      priority,
      maxResults: priority === 1 ? 10 : 6,
      requiredCapabilities,
    };
  }

  private buildStoppingConditions(
    task: ResearchTaskProfile,
    issues: ResearchIssue[],
    missing: ResearchCapability[],
  ): ExecutableResearchPlan['stoppingConditions'] {
    const issueIds = issues.map((issue) => issue.id);
    if (missing.length > 0) {
      return [
        {
          id: 'required-capability-unavailable',
          description: `Stop before execution: ${missing.join(', ')} unavailable or unverified`,
          metric: 'CAPABILITY_UNAVAILABLE',
          hard: true,
          appliesToIssueIds: issueIds,
        },
      ];
    }
    if (task.kind === 'CITATION_VERIFICATION' || task.kind === 'CASE_LOOKUP') {
      return [{
        id: 'citation-resolved',
        description: 'Stop when the authority identity and citation are verified from a primary record.',
        metric: 'CITATION_RESOLVED',
        threshold: 1,
        hard: true,
        appliesToIssueIds: issueIds,
      }];
    }
    if (task.kind === 'CASE_SURVEY') {
      return [{
        id: 'case-survey-coverage',
        description:
          'Complete when two directly relevant judgments are admitted; one judgment permits a partial survey.',
        metric: 'PRIMARY_AUTHORITIES_PER_ISSUE',
        threshold: 2,
        hard: false,
        appliesToIssueIds: issueIds,
      }];
    }
    const conditions: ExecutableResearchPlan['stoppingConditions'] = [
      {
        id: 'primary-coverage',
        description: 'Each material issue has primary authority coverage.',
        metric: 'PRIMARY_AUTHORITIES_PER_ISSUE',
        threshold: task.kind === 'CASE_COMPARISON' ? 2 : 1,
        hard: true,
        appliesToIssueIds: issueIds,
      },
      {
        id: 'contrary-complete',
        description: 'Positive, negative, and contrary-authority searches are complete.',
        metric: 'CONTRARY_CHECK_COMPLETE',
        hard: true,
        appliesToIssueIds: issueIds,
      },
    ];
    if (
      task.kind === 'CURRENT_LAW' ||
      task.kind === 'STATUTORY_INTERPRETATION' ||
      task.kind === 'SECTION_LOOKUP'
    ) {
      conditions.push({
        id: 'current-law-complete',
        description: 'Statutory version and subsequent treatment checks are complete.',
        metric: 'CURRENT_LAW_CHECK_COMPLETE',
        hard: true,
        appliesToIssueIds: issueIds,
      });
    }
    return conditions;
  }

  private place(request: NormalizedResearchRequest): string {
    return request.jurisdiction ?? request.countryCode ?? 'the applicable jurisdiction';
  }
}
