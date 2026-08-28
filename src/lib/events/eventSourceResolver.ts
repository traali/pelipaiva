import type { MatchdayEvent, PlayerProfile } from '../../types/matchday';

export interface EventSourceInfo {
  isCombined: boolean;
  badgeText: string;
  sourceList: string[];
  tooltipDetails?: string;
}

/**
 * Resolves the origin data sources for a matchday event (e.g. Torneopal + MyClub, Palloliitto, WhatsApp OCR, etc.)
 * and indicates clearly if data was merged from multiple verified sources.
 */
export function resolveEventSourceInfo(
  event: MatchdayEvent,
  profile?: PlayerProfile
): EventSourceInfo {
  const sources: string[] = [];

  // 1. Detect Federation / Association data source
  const assocUrl = profile?.associationUrl?.toLowerCase() || '';
  const assocType = profile?.associationType;
  const fixtureId = event.officialFixtureId || '';

  if (
    assocType === 'palloliitto' ||
    assocUrl.includes('palloliitto') ||
    fixtureId.startsWith('palloliitto')
  ) {
    sources.push('Palloliitto');
  } else if (
    assocType === 'salibandy' ||
    assocUrl.includes('salibandy') ||
    fixtureId.startsWith('salibandy')
  ) {
    sources.push('Salibandyliitto');
  } else if (
    assocType === 'basket' ||
    assocUrl.includes('basket') ||
    fixtureId.startsWith('basket')
  ) {
    sources.push('Basket.fi');
  } else if (
    assocType === 'torneopal' ||
    assocUrl.includes('torneopal') ||
    assocUrl.includes('lentopallo') ||
    fixtureId.startsWith('torneopal')
  ) {
    sources.push('Torneopal');
  }

  // 2. Detect Club system / Calendar / Drop-in source
  const calUrl = profile?.calendarUrl?.toLowerCase() || '';
  const eventId = event.id || '';

  if (calUrl.includes('myclub')) {
    sources.push('MyClub');
  } else if (calUrl.includes('nimenhuuto')) {
    sources.push('Nimenhuuto');
  } else if (calUrl.includes('jopox')) {
    sources.push('Jopox');
  } else if (calUrl.includes('suomisport')) {
    sources.push('SuomiSport');
  } else if (
    eventId.startsWith('dropin_') ||
    eventId.startsWith('nlp_') ||
    eventId.startsWith('ocr_') ||
    eventId.startsWith('wa_')
  ) {
    sources.push('WhatsApp');
  } else if (
    calUrl &&
    calUrl.length > 5 &&
    !calUrl.includes('palloliitto') &&
    !calUrl.includes('torneopal') &&
    !calUrl.includes('basket') &&
    !calUrl.includes('salibandy')
  ) {
    sources.push('iCal-kalenteri');
  }

  // If an official fixture is linked, ensure official federation source is present
  if (fixtureId && !sources.some((s) => ['Palloliitto', 'Salibandyliitto', 'Basket.fi', 'Torneopal'].includes(s))) {
    if (event.sport === 'football') sources.unshift('Palloliitto');
    else if (event.sport === 'floorball') sources.unshift('Salibandyliitto');
    else if (event.sport === 'basketball') sources.unshift('Basket.fi');
    else sources.unshift('Tulospalvelu');
  }

  // 3. User direct chat updates (WhatsApp / NLP chat input)
  if (event.hasWhatsAppUpdates || (event.chatMessages && event.chatMessages.length > 0)) {
    sources.push('WhatsApp');
  }

  // Deduplicate
  const uniqueSources = Array.from(new Set(sources));

  // If no sources detected yet, check title / tournament / default
  if (uniqueSources.length === 0) {
    if (event.tournamentName || event.stage) {
      uniqueSources.push('Torneopal');
    } else {
      uniqueSources.push('Tulospalvelu');
    }
  }

  const isCombined = uniqueSources.length >= 2;

  const badgeText = isCombined
    ? `🔗 Yhdistetty: ${uniqueSources.join(' + ')}`
    : `📋 Lähde: ${uniqueSources[0]}`;

  return {
    isCombined,
    badgeText,
    sourceList: uniqueSources,
    tooltipDetails: isCombined
      ? `Tapahtuman tiedot on yhdistetty automaattisesti lähteistä ${uniqueSources.join(' ja ')}.`
      : `Tiedot noudettu lähteestä ${uniqueSources[0]}.`
  };
}
