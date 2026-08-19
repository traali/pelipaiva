import { Coordinates, ParkingInfo } from '../../types/matchday';

/**
 * Calculates the legal parking disc arrival time according to Finland's Road Traffic Act (Tieliikennelaki 2020 § 40).
 * Rule: Arrival time is marked as the following full hour or half hour, whichever comes next.
 */
export function calculateParkingDiscTime(arrivalDate: Date = new Date()): string {
  const mins = arrivalDate.getMinutes();
  const discDate = new Date(arrivalDate);

  if (mins === 0 || mins === 30) {
    // Exactly on the mark
    return arrivalDate.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
  } else if (mins < 30) {
    discDate.setMinutes(30, 0, 0);
  } else {
    discDate.setHours(discDate.getHours() + 1, 0, 0, 0);
  }

  return discDate.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
}

export function calculateParkingEase(
  venueName: string,
  coords: Coordinates,
  matchDate: Date = new Date()
): ParkingInfo {
  const isWeekend = matchDate.getDay() === 0 || matchDate.getDay() === 6;
  const matchHour = matchDate.getHours();
  const isRushHour = !isWeekend && matchHour >= 16 && matchHour <= 18;

  const lower = venueName.toLowerCase();

  // 1. High-Density Urban Venues (Töölö, Kallio/Brahe, Punavuori)
  if (
    lower.includes('töölö') ||
    lower.includes('bollis') ||
    lower.includes('sahara') ||
    lower.includes('brahe') ||
    lower.includes('braku') ||
    lower.includes('väiski')
  ) {
    return {
      easeScore: 'tight',
      easeScoreValue: 25,
      lotName: 'Kadunvarsipysäköinti / Stadionin hiekkakenttä',
      coordinates: { lat: coords.lat + 0.002, lng: coords.lng + 0.001 },
      feeZone: isWeekend ? 'Maksuton (Tarkista kiekkorajoitus)' : 'Vyöhyke 2 (2,00 €/h) / 2h kiekko',
      parkingDiscRequired: true,
      maxParkingHours: 2,
      walkingTimeMinutes: 5,
      walkingDistanceMeters: 380,
      warnings: [
        'Ahdas kadunvarsipysäköinti',
        'Korkea pysäköintisakkoriski iltaisin',
        'Suositellaan saapumista 20 min etuajassa'
      ],
      mapsNavigationUrl: `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`
    };
  }

  // 2. Suburban Dedicated Sports Parks (Tapiola, Matinkylä, Leppävaara, Myyrmäki, Puotila)
  if (
    lower.includes('matinkylä') ||
    lower.includes('tapiola') ||
    lower.includes('myyrmäki') ||
    lower.includes('leppävaara') ||
    lower.includes('puotila') ||
    lower.includes('käpylä') ||
    lower.includes('kauppi') ||
    lower.includes('kupittaa')
  ) {
    return {
      easeScore: isRushHour ? 'moderate' : 'easy',
      easeScoreValue: isRushHour ? 65 : 95,
      lotName: `${venueName} Pääparkkialue`,
      coordinates: { lat: coords.lat + 0.0005, lng: coords.lng + 0.0005 },
      feeZone: 'Maksuton (Pysäköintikiekko 4h)',
      parkingDiscRequired: true,
      maxParkingHours: 4,
      walkingTimeMinutes: 2,
      walkingDistanceMeters: 140,
      warnings: isRushHour ? ['Pääparkki voi ruuhkautua ennen 17:30 alkulämpöä'] : [],
      mapsNavigationUrl: `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`
    };
  }

  // 3. Default Moderate
  return {
    easeScore: 'moderate',
    easeScoreValue: 60,
    lotName: 'Lähin urheilupuiston pysäköintialue',
    coordinates: coords,
    feeZone: 'Pysäköintikiekko 2h-4h',
    parkingDiscRequired: true,
    maxParkingHours: 3,
    walkingTimeMinutes: 3,
    walkingDistanceMeters: 200,
    warnings: ['Aseta pysäköintikiekko saapuessa'],
    mapsNavigationUrl: `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`
  };
}
