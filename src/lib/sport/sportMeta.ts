import type { SportType } from '../../types/matchday';

export function sportLabelFi(sport: SportType): string {
  switch (sport) {
    case 'football':
      return 'Jalkapallo';
    case 'floorball':
      return 'Salibandy';
    case 'basketball':
      return 'Koripallo';
    case 'volleyball':
      return 'Lentopallo';
    case 'icehockey':
      return 'Jääkiekko';
    case 'futsal':
      return 'Futsal';
    case 'training':
      return 'Harjoitus';
    case 'school':
      return 'Koulu';
    case 'other':
      return 'Muu meno';
    default:
      return 'Tapahtuma';
  }
}

export type SportIconName =
  | 'goal'
  | 'target'
  | 'circle-dot'
  | 'volleyball'
  | 'snowflake'
  | 'footprints'
  | 'dumbbell'
  | 'school'
  | 'calendar'
  | 'trophy';

export function sportIconName(sport: SportType): SportIconName {
  switch (sport) {
    case 'football':
      return 'goal';
    case 'floorball':
      return 'target';
    case 'basketball':
      return 'circle-dot';
    case 'volleyball':
      return 'volleyball';
    case 'icehockey':
      return 'snowflake';
    case 'futsal':
      return 'footprints';
    case 'training':
      return 'dumbbell';
    case 'school':
      return 'school';
    case 'other':
      return 'calendar';
    default:
      return 'trophy';
  }
}
