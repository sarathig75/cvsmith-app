import type { SuggestionRequest } from '../types';
import type { CvDraft } from '../types/cvDraft';

export type ImproveTarget = { request: SuggestionRequest; label: string };

/**
 * The fields "Improve all" asks suggestions for, in the order they are asked: job and project descriptions
 * first, then the summary, then the headline. The summary and headline are written from the rest of the saved
 * CV, so they come last and see the improved descriptions. Fields with nothing to improve are left out; the
 * summary and headline are included whenever the CV has something to write them from.
 */
export function improveTargets(draft: CvDraft): ImproveTarget[] {
  const targets: ImproveTarget[] = [];
  for (const e of draft.experience) {
    if (!e.description?.trim()) continue;
    const who = [e.title, e.company].filter(Boolean).join(' at ');
    targets.push({
      label: who ? `Work experience: ${who}` : 'Work experience',
      request: {
        field: 'experience',
        entry_id: e.id,
        text: e.description,
        context: { title: e.title ?? '', company: e.company ?? '' },
      },
    });
  }
  for (const e of draft.projects) {
    if (!e.description?.trim()) continue;
    targets.push({
      label: e.name ? `Project: ${e.name}` : 'Project',
      request: { field: 'projects', entry_id: e.id, text: e.description, context: { title: e.name ?? '' } },
    });
  }
  const hasFacts = targets.length > 0 || draft.experience.some((e) => e.title || e.company) || !!draft.summary.trim();
  if (hasFacts) {
    targets.push({ label: 'Professional summary', request: { field: 'summary', text: draft.summary } });
    targets.push({ label: 'Headline', request: { field: 'headline', text: draft.personal.headline } });
  }
  return targets;
}
