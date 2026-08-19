import { PitchSurface, VenueInfo } from '../../types/matchday';
import { db } from '../storage/db';

export const NATIONAL_FIELD_ALIASES: Record<
  string,
  {
    name: string;
    lat: number;
    lng: number;
    isIndoor: boolean;
    surface: PitchSurface;
    hasFloodlights: boolean;
  }
> = {
  // Helsinki
  'bubu': { name: 'Puotilan Tekonurmi (Bubu)', lat: 60.2132, lng: 25.1098, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'puotila tn': { name: 'Puotilan Tekonurmi', lat: 60.2132, lng: 25.1098, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'väiski': { name: 'Väinämöisen kenttä (Väiski)', lat: 60.1741, lng: 24.9192, isIndoor: false, surface: 'sand_artificial_turf', hasFloodlights: true },
  'väinämöinen tn': { name: 'Väinämöisen kenttä', lat: 60.1741, lng: 24.9192, isIndoor: false, surface: 'sand_artificial_turf', hasFloodlights: true },
  'sahara': { name: 'Töölön Sahara Tekonurmi', lat: 60.1882, lng: 24.9254, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'bollis': { name: 'Töölön Pallokenttä 1 (Bollis)', lat: 60.1872, lng: 24.9248, isIndoor: false, surface: 'natural_grass', hasFloodlights: true },
  'töölön pk 1': { name: 'Töölön Pallokenttä 1', lat: 60.1872, lng: 24.9248, isIndoor: false, surface: 'natural_grass', hasFloodlights: true },
  'töölön pk 2': { name: 'Töölön Pallokenttä 2', lat: 60.1878, lng: 24.9242, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'töölön pk 6': { name: 'Töölön Pallokenttä 6', lat: 60.1891, lng: 24.9231, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'brahenkenttä': { name: 'Brahenkenttä (Braku)', lat: 60.1878, lng: 24.9518, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'braku': { name: 'Brahenkenttä (Braku)', lat: 60.1878, lng: 24.9518, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'käpylä tn 1': { name: 'Käpylän Urheilupuisto TN 1', lat: 60.2135, lng: 24.9452, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'käpylä tn 2': { name: 'Käpylän Urheilupuisto TN 2', lat: 60.2142, lng: 24.9445, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'käpa kupla': { name: 'Käpylän Kuplahalli', lat: 60.2140, lng: 24.9460, isIndoor: true, surface: 'artificial_turf_3g', hasFloodlights: true },
  'töölön kisahalli': { name: 'Töölön Kisahalli (Kisis)', lat: 60.1835, lng: 24.9282, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'kisis': { name: 'Töölön Kisahalli (Kisis)', lat: 60.1835, lng: 24.9282, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'mosahalli': { name: 'Tapanilan Mosahalli', lat: 60.2612, lng: 25.0234, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },

  // Espoo & Vantaa
  'matinkylä tn 1': { name: 'Matinkylän Urheilupuisto TN 1', lat: 60.1582, lng: 24.7505, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'matinkylä tn 2': { name: 'Matinkylän Urheilupuisto TN 2', lat: 60.1578, lng: 24.7512, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'tapiola tn 1': { name: 'Tapiolan Urheilupuisto TN 1', lat: 60.1785, lng: 24.7865, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'tapiola tn 2': { name: 'Tapiolan Urheilupuisto TN 2', lat: 60.1790, lng: 24.7872, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'honkahalli': { name: 'Honkahalli Tapiola', lat: 60.1792, lng: 24.7880, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'myyrmäki jalkapallostadion': { name: 'Myyrmäen Jalkapallostadion', lat: 60.2625, lng: 24.8510, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'myyrmäki stadion': { name: 'Myyrmäen Jalkapallostadion', lat: 60.2625, lng: 24.8510, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'energia areena': { name: 'Vantaan Energia Areena', lat: 60.2642, lng: 24.8528, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'leppävaara tn': { name: 'Leppävaaran Urheilupuisto TN', lat: 60.2240, lng: 24.8105, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'arena center ruskeasuo': { name: 'Arena Center Ruskeasuo', lat: 60.1980, lng: 24.9080, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'arena center myyrmäki': { name: 'Arena Center Myyrmäki', lat: 60.2610, lng: 24.8540, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },

  // Major National Sports Hubs
  'kauppi tn 1': { name: 'Tampereen Kaupin Urheilupuisto TN 1', lat: 61.5034, lng: 23.8052, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'kauppi tn 2': { name: 'Tampereen Kaupin Urheilupuisto TN 2', lat: 61.5040, lng: 23.8060, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'kupittaa 5': { name: 'Turun Kupittaan Tekonurmi 5', lat: 60.4430, lng: 22.2885, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'kupittaa tn': { name: 'Turun Kupittaan Tekonurmi', lat: 60.4430, lng: 22.2885, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'vehkalampi tn': { name: 'Jyväskylän Vehkalammen Tekonurmi', lat: 62.2355, lng: 25.7198, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'vehkalampi': { name: 'Jyväskylän Vehkalammen Tekonurmi', lat: 62.2355, lng: 25.7198, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'heinäpää tn': { name: 'Oulun Heinäpään Tekonurmi', lat: 65.0032, lng: 25.4542, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'castren': { name: 'Oulun Castrenin Tekonurmi', lat: 65.0180, lng: 25.4850, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'kisapuisto tn': { name: 'Lahden Kisapuiston Tekonurmi', lat: 60.9850, lng: 25.6540, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true }
};

export async function resolveSportsVenue(rawVenueString: string): Promise<VenueInfo> {
  const normalized = rawVenueString
    .toLowerCase()
    .replace(/[\.,\-\/\(\)]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 1. Check IndexedDB User Custom Pins first
  try {
    const customPin = await db.venuePins.get(normalized);
    if (customPin) {
      return {
        name: customPin.venueName,
        normalizedName: normalized,
        coordinates: { lat: customPin.lat, lng: customPin.lng },
        isIndoor: customPin.isIndoor,
        surface: (customPin.surface as PitchSurface) || 'artificial_turf_3g',
        hasFloodlights: true,
        isUserPinned: true
      };
    }
  } catch {
    // Database access fallback if testing outside browser
  }

  // 2. Check Curated National Alias Dictionary
  for (const [alias, data] of Object.entries(NATIONAL_FIELD_ALIASES)) {
    if (normalized.includes(alias)) {
      return {
        name: data.name,
        normalizedName: normalized,
        coordinates: { lat: data.lat, lng: data.lng },
        isIndoor: data.isIndoor,
        surface: data.surface,
        hasFloodlights: data.hasFloodlights
      };
    }
  }

  // 3. Query LIPAS.fi (National Sports Facility API - covers all 42,000+ Finnish venues)
  if (typeof fetch !== 'undefined') {
    try {
      const lipasUrl = `https://lipas.fi/api/sports-places?searchString=${encodeURIComponent(rawVenueString)}&fields=name,location.coordinates.wgs84,type.name,properties`;
      const res = await fetch(lipasUrl, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const top = data[0];
          const coords = top.location?.coordinates?.wgs84;
          if (coords && coords.lat && coords.lon) {
            const typeName = (top.type?.name || '').toLowerCase();
            const isIndoor =
              typeName.includes('halli') ||
              typeName.includes('sali') ||
              typeName.includes('koulu') ||
              typeName.includes('areena');
            let surface: PitchSurface = 'artificial_turf_3g';
            if (typeName.includes('nurmi') && !typeName.includes('teko')) surface = 'natural_grass';
            if (typeName.includes('hiekka')) surface = 'sand_artificial_turf';
            if (isIndoor) surface = typeName.includes('parketti') ? 'indoor_parquet' : 'indoor_synthetic';

            return {
              name: top.name || rawVenueString,
              normalizedName: normalized,
              address: top.location?.address,
              city: top.location?.city?.name,
              postalCode: top.location?.postalCode,
              coordinates: { lat: coords.lat, lng: coords.lon },
              isIndoor,
              surface,
              hasFloodlights: top.properties?.surface_lighting === true,
              lipasId: top.sportsPlaceId
            };
          }
        }
      }
    } catch {
      // Fallback
    }

    // 4. Fallback: Palvelukartta (Helsinki Metropolitan Area)
    try {
      const pUrl = `https://api.hel.fi/servicemap/v2/search/?q=${encodeURIComponent(rawVenueString)}&type=unit`;
      const pRes = await fetch(pUrl);
      if (pRes.ok) {
        const pJson = await pRes.json();
        if (pJson.results && pJson.results.length > 0) {
          const top = pJson.results[0];
          if (top.location && top.location.coordinates) {
            const [lng, lat] = top.location.coordinates;
            return {
              name: top.name?.fi || rawVenueString,
              normalizedName: normalized,
              address: top.street_address?.fi,
              coordinates: { lat, lng },
              isIndoor: normalized.includes('halli') || normalized.includes('arena'),
              surface: 'artificial_turf_3g',
              hasFloodlights: true
            };
          }
        }
      }
    } catch {
      // Fallback
    }
  }

  // 5. Ultimate Fallback (Default to center of Helsinki Töölö sports hub)
  return {
    name: rawVenueString || 'Tuntematon kenttä',
    normalizedName: normalized,
    coordinates: { lat: 60.1872, lng: 24.9248 },
    isIndoor: normalized.includes('halli') || normalized.includes('center'),
    surface: 'artificial_turf_3g',
    hasFloodlights: true
  };
}
