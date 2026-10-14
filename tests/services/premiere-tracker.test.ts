import {
  episodeLabel,
  pickPremiereAlerts,
  PREMIERES,
  type PremiereLabels,
} from '@/services/premiere-tracker';

const labels: PremiereLabels = {
  premiereTomorrow: (show, episode) => `${show} ${episode} tomorrow`,
  premiereToday: (show, episode) => `${show} ${episode} today`,
};

describe('Vision Quest schedule', () => {
  it('covers all 8 season-1 episodes on their real dates', () => {
    expect(PREMIERES).toHaveLength(8);
    expect(PREMIERES[0]).toMatchObject({
      id: 'vision-quest-s1e1',
      show: 'Vision Quest',
      season: 1,
      episode: 1,
      airDate: '2026-10-14',
    });
    expect(PREMIERES[7]).toMatchObject({ episode: 8, airDate: '2026-11-11' });
  });
});

describe('pickPremiereAlerts', () => {
  it('alerts 1 day early for tomorrow’s drop', () => {
    // Oct 13: E1/E2 drop tomorrow.
    const alerts = pickPremiereAlerts(PREMIERES, '2026-10-13', [], labels);

    expect(alerts.map((alert) => alert.key)).toEqual([
      'vision-quest-s1e1',
      'vision-quest-s1e2',
    ]);
    expect(alerts[0].body).toContain('tomorrow');
    expect(alerts[0].body).toContain('S1 E1');
  });

  it('alerts day-of for today’s drops', () => {
    const alerts = pickPremiereAlerts(PREMIERES, '2026-10-14', [], labels);

    expect(alerts.map((alert) => alert.key)).toEqual([
      'vision-quest-s1e1',
      'vision-quest-s1e2',
    ]);
    expect(alerts[0].body).toContain('today');
  });

  it('never repeats an alerted drop', () => {
    const alerts = pickPremiereAlerts(
      PREMIERES,
      '2026-10-14',
      ['vision-quest-s1e1', 'vision-quest-s1e2'],
      labels,
    );

    expect(alerts).toEqual([]);
  });

  it('stays silent far from any drop', () => {
    expect(pickPremiereAlerts(PREMIERES, '2026-12-01', [], labels)).toEqual([]);
  });

  it('labels episodes as Sseason Een', () => {
    expect(episodeLabel({ season: 2, episode: 4 })).toBe('S2 E4');
  });
});
