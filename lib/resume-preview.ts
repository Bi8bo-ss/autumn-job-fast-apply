import { resumeContentSchema, type ResumeContent, type TuneSuggestion } from './product-types';
import { normalizeResumeContent } from './resume-parser';
import { applyResumeSuggestion } from './resume-suggestions';

export function buildResumePreviewContent(
  version: { contentJson: string; sourceText: string } | undefined,
  suggestions: TuneSuggestion[],
  active: TuneSuggestion | undefined,
  drafts: Record<string, string>,
): ResumeContent | null {
  if (!version?.contentJson) return null;
  try {
    const raw = resumeContentSchema.parse(JSON.parse(version.contentJson));
    let content = normalizeResumeContent(raw, version.sourceText);
    for (const item of suggestions) {
      if (item.state === 'accepted' && item.id !== active?.id) {
        content = applyResumeSuggestion(content, item.sectionKey, item.originalText, item.editedText ?? item.proposedText);
      }
    }
    if (active) {
      const draft = drafts[active.id] ?? active.editedText ?? active.proposedText;
      content = applyResumeSuggestion(content, active.sectionKey, active.originalText, draft);
    }
    return content;
  } catch {
    return null;
  }
}
