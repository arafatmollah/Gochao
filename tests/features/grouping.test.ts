import { buildActiveSections, buildCompletedSection } from '@/features/tasks/grouping';

import { makeTask } from '../helpers/factories';

const TODAY = '2026-10-11';

describe('task grouping', () => {
  it('splits pending tasks into overdue, today, upcoming and no-due-date sections', () => {
    const pending = [
      makeTask({ id: 'a', dueAt: '2026-10-05' }),
      makeTask({ id: 'b', dueAt: TODAY }),
      makeTask({ id: 'c', dueAt: '2026-10-20' }),
      makeTask({ id: 'd', dueAt: null }),
    ];

    const sections = buildActiveSections(pending, [], TODAY);

    expect(sections.map((s) => s.key)).toEqual(['overdue', 'today', 'upcoming', 'no-date']);
    expect(sections[0].tone).toBe('danger');
    expect(sections[0].data.map((t) => t.id)).toEqual(['a']);
    expect(sections[1].data.map((t) => t.id)).toEqual(['b']);
    expect(sections[2].data.map((t) => t.id)).toEqual(['c']);
    expect(sections[3].data.map((t) => t.id)).toEqual(['d']);
  });

  it('preserves repository ordering within each section', () => {
    const pending = [
      makeTask({ id: 'first', dueAt: '2026-10-12', priority: 'high' }),
      makeTask({ id: 'second', dueAt: '2026-10-12', priority: 'low' }),
      makeTask({ id: 'third', dueAt: '2026-10-13' }),
    ];

    const sections = buildActiveSections(pending, [], TODAY);
    const upcoming = sections.find((s) => s.key === 'upcoming');
    expect(upcoming?.data.map((t) => t.id)).toEqual(['first', 'second', 'third']);
  });

  it('omits empty sections and appends recently completed', () => {
    const completed = [
      makeTask({
        id: 'done-1',
        status: 'completed',
        completedAt: '2026-10-10T10:00:00.000Z',
      }),
    ];

    const sections = buildActiveSections([], completed, TODAY);

    expect(sections.map((s) => s.key)).toEqual(['recent-completed']);
    expect(sections[0].data.map((t) => t.id)).toEqual(['done-1']);
  });

  it('returns no sections for an empty list', () => {
    expect(buildActiveSections([], [], TODAY)).toEqual([]);
  });

  it('builds a single completed section, or none when empty', () => {
    const completed = [makeTask({ id: 'c1', status: 'completed', completedAt: '2026-10-10T00:00:00.000Z' })];
    expect(buildCompletedSection(completed).map((s) => s.key)).toEqual(['completed']);
    expect(buildCompletedSection([])).toEqual([]);
  });
});
