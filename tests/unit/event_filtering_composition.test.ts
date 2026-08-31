import { describe, it, expect } from 'vitest';
import { MatchdayEvent } from '../../src/types/matchday';

describe('Event Filtering Composition (2-Axis Orthogonal Facets)', () => {
  const mockEvents: MatchdayEvent[] = [
    {
      id: 'e1',
      profileId: 'p1',
      sport: 'football',
      title: 'HJK vs PPJ (Turnaus)',
      startTime: '2026-09-01T10:00:00Z',
      endTime: '2026-09-01T11:00:00Z',
      warmupTime: '2026-09-01T09:15:00Z',
      attendanceStatus: 'in',
      isTraining: false,
    },
    {
      id: 'e2',
      profileId: 'p1',
      sport: 'football',
      title: 'Turnaus Finaali: PPJ vs Honka',
      startTime: '2026-09-01T13:00:00Z',
      endTime: '2026-09-01T14:00:00Z',
      warmupTime: '2026-09-01T12:15:00Z',
      attendanceStatus: 'out',
      isTraining: false,
    },
    {
      id: 'e3',
      profileId: 'p1',
      sport: 'football',
      title: 'Sarjapeli: PPJ vs KäPa',
      startTime: '2026-09-02T17:00:00Z',
      endTime: '2026-09-02T18:30:00Z',
      warmupTime: '2026-09-02T16:15:00Z',
      attendanceStatus: 'in',
      isTraining: false,
    },
    {
      id: 'e4',
      profileId: 'p1',
      sport: 'football',
      title: 'Harjoitukset / Treenit',
      startTime: '2026-09-03T18:00:00Z',
      endTime: '2026-09-03T19:30:00Z',
      warmupTime: '2026-09-03T17:45:00Z',
      attendanceStatus: 'in',
      isTraining: true,
    },
  ];

  const isTournament = (e: MatchdayEvent) => /turnaus|cup/i.test(e.title);
  const isMatch = (e: MatchdayEvent) => !e.isTraining && !isTournament(e);
  const isTraining = (e: MatchdayEvent) => Boolean(e.isTraining);

  function filterEvents(
    events: MatchdayEvent[],
    attendance: 'all' | 'in' | 'out',
    category: 'all' | 'tournaments' | 'matches' | 'trainings'
  ): MatchdayEvent[] {
    return events.filter((e) => {
      if (attendance === 'in' && e.attendanceStatus === 'out') return false;
      if (attendance === 'out' && e.attendanceStatus !== 'out') return false;

      if (category === 'tournaments' && !isTournament(e)) return false;
      if (category === 'matches' && !isMatch(e)) return false;
      if (category === 'trainings' && !isTraining(e)) return false;

      return true;
    });
  }

  it('filters all events when both filters are set to all', () => {
    const result = filterEvents(mockEvents, 'all', 'all');
    expect(result).toHaveLength(4);
  });

  it('filters only attending events across all categories', () => {
    const result = filterEvents(mockEvents, 'in', 'all');
    expect(result).toHaveLength(3);
    expect(result.map((e) => e.id)).toEqual(['e1', 'e3', 'e4']);
  });

  it('filters only out/declined events across all categories', () => {
    const result = filterEvents(mockEvents, 'out', 'all');
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('e2');
  });

  it('composes Tournament category with Attending (IN) state', () => {
    const result = filterEvents(mockEvents, 'in', 'tournaments');
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('e1');
  });

  it('composes Tournament category with Out (Declined) state', () => {
    const result = filterEvents(mockEvents, 'out', 'tournaments');
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('e2');
  });

  it('composes Match category with Attending state', () => {
    const result = filterEvents(mockEvents, 'in', 'matches');
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('e3');
  });
});
