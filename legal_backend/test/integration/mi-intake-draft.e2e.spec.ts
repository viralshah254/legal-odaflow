/**
 * E2E stub — intake classify → matter create → draft recommend → india generate.
 * Full E2E requires DB + AI providers; this documents the expected flow contract.
 */

describe('E2E stub — MI intake to draft flow', () => {
  const FLOW_STEPS = [
    'POST /consumers/issue-checker/classify → matterProfile + taskGraph',
    'POST /consumers/cases → persist matterProfile on ConsumerCase',
    'POST /consumers/issue-checker/preview → MI refresh + preview report',
    'POST /draft-intent/resolve → documentKind from resolveMatterDocumentKind',
    'POST /india-draft/generate → dependency gate via targetDocumentKind',
  ] as const;

  it('defines the canonical intake→draft pipeline steps', () => {
    expect(FLOW_STEPS).toHaveLength(5);
    expect(FLOW_STEPS[0]).toContain('classify');
    expect(FLOW_STEPS[3]).toContain('draft-intent');
  });

  it('marks full E2E as pending infrastructure', () => {
    expect(process.env.MI_E2E_ENABLED).not.toBe('true');
  });
});
