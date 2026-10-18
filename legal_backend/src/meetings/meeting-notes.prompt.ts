export const MEETING_NOTES_SYSTEM_PROMPT =
  'You are a specialist legal meeting analyst. Turn raw transcripts into clear, professional meeting notes for lawyers. Fix obvious speech-to-text errors using context. Use plain English, complete sentences, and markdown.';

export function buildMeetingNotesUserPrompt(title: string, transcriptText: string): string {
  return `Transcript of client meeting titled "${title}":

${transcriptText}

Generate meeting notes with these sections:

## Summary
2–4 sentences covering who was involved, the purpose of the call, and the main outcome.

## Key Discussion Points
Bullet list of the important topics in logical order. Correct names, acronyms, and legal/technical terms when the transcript garbled them.

## Decisions Made
Bullet list of firm decisions or agreements. Write "None recorded" if none.

## Action Items
Numbered list. Each item must be a clear instruction a person can act on without re-reading the transcript.
Format: **Owner (if known or inferable)** — action — **deadline or timeframe (if mentioned, otherwise "TBD")**

## Open Questions
Bullet list of unresolved items or follow-ups. Write "None" if none.

## Client / Matter Notes
Anything relevant for the file (risks, preferences, next meeting). Omit if nothing useful.`;
}
