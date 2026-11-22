// After a Pyware or OpenMarch import: what came in, and what to check before teaching it. A director can then decide
// whether the converted show is ready, instead of finding a missing measure or a bad step at rehearsal.
import { reviewShow, type Issue, type IssueKind } from './review';
import { totalCounts, type Show } from './show';

export interface ImportSummary {
  /** What came in, a line each: performers and sections, sets and counts, measures, the recording, routes. */
  came: string[];
  /** What to check: the importer's own notes (approximated or left out), then what Review finds. */
  check: string[];
  /** Review's problems, so the summary can open Review or go to the first one. */
  issues: Issue[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const KIND_WORDS: Record<IssueKind, [string, string]> = {
  steps: ['move with steps over the limit', 'moves with steps over the limit'],
  close: ['place where performers come too close', 'places where performers come too close'],
  straight: ['set where imported paths went straight', 'sets where imported paths went straight'],
  missing: ['set with performers missing a spot', 'sets with performers missing a spot'],
  unwritten: ['stretch of counts with no sets yet', 'stretches of counts with no sets yet'],
  letters: ['letter two sections share', 'letters two sections share'],
};

/** The summary for a just-imported show. `audio`: the recording itself came in (not just its timings). */
export function importSummary(show: Show, opts: { audio: boolean; notes: string[] }): ImportSummary {
  const came: string[] = [];
  const named = show.performers.filter((p) => p.name).length;
  came.push(`${plural(show.performers.length, 'performer')} in ${plural(show.sections.length, 'section')}${named ? `, ${named === show.performers.length ? 'all' : named} with names` : ''}.`);
  const moves = show.sets.length - 1;
  came.push(`${plural(show.sets.length, 'set')} (${show.sets[0].name} to ${show.sets.at(-1)!.name}), ${plural(totalCounts(show), 'count')}.`);
  if (moves > 0) {
    const m = show.sets.slice(1).filter((s) => s.measures).length;
    came.push(m === moves ? 'Measure numbers on every set.' : m ? `Measure numbers on ${m} of ${moves} sets.` : 'No measure numbers. Type them under each set (or add the score under Music) to get them on paper and phones.');
  }
  const routed = show.sets.filter((s) => (s.paths && Object.keys(s.paths).length) || s.ftl?.length).length;
  if (routed) came.push(`Curved or follow-the-leader routes in ${plural(routed, 'set')}, kept count by count.`);
  if (show.music) came.push(opts.audio ? `The recording ("${show.music.name}"), timed to the counts.` : `The counts' timing for "${show.music.name}", but not the recording itself: add it under Music.`);
  if (show.props?.length) came.push(`${plural(show.props.length, 'prop')}.`);

  const issues = reviewShow(show);
  const check = [...opts.notes];
  const byKind = new Map<IssueKind, number>();
  for (const x of issues) byKind.set(x.kind, (byKind.get(x.kind) ?? 0) + 1);
  for (const [kind, n] of byKind) check.push(`Review finds ${n} ${n === 1 ? KIND_WORDS[kind][0] : KIND_WORDS[kind][1]}.`);
  return { came, check, issues };
}
