import type {
  AssociationType,
  ParsedAssociationUrl,
  SportType
} from '../../types/matchday';
import {
  SUBDOMAIN_SPORT_MAP,
  normalizeUrlString,
  inferSportFromSubdomain,
  parseAssociationUrl,
  isAssociationUrl,
  getAssociationName,
  getAssociationShortName,
  getSportName,
  formatCanonicalTeamUrl,
  extractTeamIdFromUrl,
  getAssociationFromUrl
} from '../stats/statsEngine';

export {
  SUBDOMAIN_SPORT_MAP,
  normalizeUrlString,
  inferSportFromSubdomain,
  parseAssociationUrl,
  isAssociationUrl,
  getAssociationName,
  getAssociationShortName,
  getSportName,
  formatCanonicalTeamUrl,
  extractTeamIdFromUrl,
  getAssociationFromUrl
};

export type {
  AssociationType,
  ParsedAssociationUrl,
  SportType
};

/**
 * Detects association federation type from raw URL string.
 */
export function detectAssociationType(rawUrl: string): AssociationType | null {
  const parsed = parseAssociationUrl(rawUrl);
  return parsed ? parsed.association : null;
}

/**
 * Returns canonical normalized URL for an association team link.
 */
export function normalizeAssociationUrl(rawUrl: string): string | null {
  const parsed = parseAssociationUrl(rawUrl);
  return parsed ? parsed.canonicalUrl : null;
}
