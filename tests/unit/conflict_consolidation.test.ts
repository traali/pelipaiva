import { describe, it, expect } from 'vitest';
import { groupActiveConflicts } from '../../src/lib/agents/conflictDismissal';
import type { FamilyConflict } from '../../src/lib/agents/types';

describe('Conflict Consolidation (groupActiveConflicts)', () => {
  it('returns empty array when given empty or undefined conflicts', () => {
    expect(groupActiveConflicts([])).toEqual([]);
    expect(groupActiveConflicts(undefined as unknown as FamilyConflict[])).toEqual([]);
  });

  it('keeps single standalone conflict unbundled without sub-items', () => {
    const single: FamilyConflict = {
      id: 'c-1-2',
      severity: 'critical',
      childA: 'Lassi',
      childB: 'Lassi',
      eventAId: 'ev-1',
      eventBId: 'ev-2',
      venueA: 'Lauttasaari',
      venueB: 'Töölö',
      overlapMinutes: 45,
      gapMinutes: 0,
      message: 'Päällekkäisyys: Lassi on merkitty kahteen peliin samaan aikaan päällekkäin 45 min.',
      suggestedFix: 'Ilmoita valmentajalle valinta.'
    };

    const grouped = groupActiveConflicts([single]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].id).toBe('c-1-2');
    expect(grouped[0].maxOverlap).toBe(45);
    expect(grouped[0].minGap).toBe(0);
    expect(grouped[0].subItems).toHaveLength(0);
    expect(grouped[0].conflicts).toHaveLength(1);
  });

  it('consolidates multiple tournament match collisions for the same child into 1 single group', () => {
    const multiMatchConflicts: FamilyConflict[] = [
      {
        id: 'c-tourney-1',
        severity: 'critical',
        childA: 'S',
        childB: 'S',
        eventAId: 'ev-main',
        eventBId: 'ev-sub1',
        venueA: 'Lauttasaaren urheilupuisto "Pyrkkä"',
        venueB: 'Lauttasaari TN B',
        overlapMinutes: 105,
        gapMinutes: 0,
        message: 'Päällekkäisyys: S on merkitty kahteen peliin samaan aikaan päällekkäin 105 min.',
        suggestedFix: 'Ilmoita valmentajalle valinta.'
      },
      {
        id: 'c-tourney-2',
        severity: 'warn',
        childA: 'S',
        childB: 'S',
        eventAId: 'ev-main',
        eventBId: 'ev-sub2',
        venueA: 'Lauttasaaren urheilupuisto "Pyrkkä"',
        venueB: 'Lauttasaaren urheilupuisto "Pyrkkä"',
        overlapMinutes: 75,
        gapMinutes: 0,
        message: 'Päällekkäisyys: S on merkitty kahteen peliin samaan aikaan päällekkäin 75 min.',
        suggestedFix: 'Ilmoita valmentajalle valinta.'
      },
      {
        id: 'c-tourney-3',
        severity: 'warn',
        childA: 'S',
        childB: 'S',
        eventAId: 'ev-main',
        eventBId: 'ev-sub3',
        venueA: 'Lauttasaaren urheilupuisto "Pyrkkä"',
        venueB: 'Lauttasaari TN B',
        overlapMinutes: 35,
        gapMinutes: 0,
        message: 'Päällekkäisyys: S on merkitty kahteen peliin samaan aikaan päällekkäin 35 min.',
        suggestedFix: 'Ilmoita valmentajalle valinta.'
      }
    ];

    const grouped = groupActiveConflicts(multiMatchConflicts);
    expect(grouped).toHaveLength(1);
    const g = grouped[0];

    expect(g.conflicts).toHaveLength(3);
    expect(g.severity).toBe('critical');
    expect(g.maxOverlap).toBe(105);
    expect(g.minGap).toBe(0);
    expect(g.title).toContain('3 päällekkäistä peliaikaa (max 105 min)');
    expect(g.subItems).toHaveLength(3);
    expect(g.subItems[0].overlap).toBe(105);
    expect(g.subItems[1].overlap).toBe(75);
    expect(g.subItems[2].overlap).toBe(35);
  });

  it('separates different sibling collision groups cleanly', () => {
    const siblingConflicts: FamilyConflict[] = [
      {
        id: 'c-sibling-1',
        severity: 'warn',
        childA: 'Lassi',
        childB: 'Ella',
        eventAId: 'ev-l1',
        eventBId: 'ev-e1',
        venueA: 'Hernesaari',
        venueB: 'Matinkylä',
        overlapMinutes: 30,
        gapMinutes: 0,
        message: 'Päällekkäisyys: Lassi ja Ella päällekkäin 30 min.',
        suggestedFix: 'Yksi vanhempi per kenttä.'
      },
      {
        id: 'c-same-1',
        severity: 'critical',
        childA: 'Lassi',
        childB: 'Lassi',
        eventAId: 'ev-l1',
        eventBId: 'ev-l2',
        venueA: 'Hernesaari',
        venueB: 'Hernesaari',
        overlapMinutes: 60,
        gapMinutes: 0,
        message: 'Päällekkäisyys: Lassi samaan aikaan kahdessa tapahtumassa.',
        suggestedFix: 'Ilmoita valinta.'
      }
    ];

    const grouped = groupActiveConflicts(siblingConflicts);
    expect(grouped).toHaveLength(2);
  });

  it('back-to-back group shows the shortest real gap, never a drive estimate', () => {
    const tight = (id: string, gap: number): FamilyConflict => ({
      id,
      severity: 'critical',
      childA: 'S',
      childB: 'S',
      eventAId: `${id}-a`,
      eventBId: `${id}-b`,
      venueA: 'Otahalli',
      venueB: 'Töölön Pallokenttä',
      overlapMinutes: 0,
      gapMinutes: gap,
      message: `Peräkkäiset pelit eri kentillä: väli ${gap} min.`,
      suggestedFix: 'Kysy valmentajalta.'
    });
    const [single] = groupActiveConflicts([tight('t1', 20)]);
    expect(single.title).toBe('Peräkkäiset pelit eri kentillä (väli 20 min)');
    expect(single.minGap).toBe(20);
    const [g] = groupActiveConflicts([tight('t1', 20), tight('t2', 10)]);
    expect(g.minGap).toBe(10);
    expect(g.subItems.map((x) => x.gap)).toEqual([20, 10]);
    expect(JSON.stringify(g)).not.toMatch(/min ajo|siirtymä|ajoaika/i);
  });
});
