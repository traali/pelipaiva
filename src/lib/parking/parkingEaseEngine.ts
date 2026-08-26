import { Coordinates, ParkingInfo, ParkingZoneSpot, TrafficSignInfo, FineRiskInfo } from '../../types/matchday';

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

  // 1. High-Density Urban Venues (Töölö, Kallio/Brahe, Punavuori, Väiski)
  if (
    lower.includes('töölö') ||
    lower.includes('bollis') ||
    lower.includes('sahara') ||
    lower.includes('brahe') ||
    lower.includes('braku') ||
    lower.includes('väiski')
  ) {
    const spots: ParkingZoneSpot[] = [
      {
        id: 'p1',
        name: 'P1: Urheilukadun & Pohjoisen Stadiontien ruudut',
        type: 'street',
        typeLabel: 'Kadunvarsiruudut',
        capacityEstimated: 35,
        restrictionText: isWeekend ? 'Maksuton viikonloppuisin (tarkista aikaraja)' : 'Vyöhyke 2 (2,00 €/h) tai 2h kiekko',
        discRequired: true,
        maxHours: 2,
        walkingTimeMinutes: 4,
        isRecommended: true
      },
      {
        id: 'p2',
        name: 'P2: Stadionin hiekkakentän P-alue',
        type: 'standard',
        typeLabel: 'Hiekkaparkki',
        capacityEstimated: 60,
        restrictionText: 'Maksullinen / Tapahtumakohtainen valvonta',
        discRequired: false,
        maxHours: 4,
        walkingTimeMinutes: 5
      },
      {
        id: 'p3',
        name: 'P3: Esteettömät invapaikat (Pääportti)',
        type: 'accessible',
        typeLabel: 'Invapaikat',
        capacityEstimated: 2,
        restrictionText: 'Vain liikkumisesteisen pysäköintitunnuksella',
        discRequired: false,
        walkingTimeMinutes: 1
      },
      {
        id: 'p_danger',
        name: 'Pelastustie ja kääntöpaikka (Olympiastadionin aitaus)',
        type: 'no_parking',
        typeLabel: 'Pysäköintikielto',
        restrictionText: 'Pysäköinti ehdottomasti kielletty (Välitön hinaus & 80 € sakko)',
        discRequired: false,
        walkingTimeMinutes: 0
      }
    ];

    const trafficSigns: TrafficSignInfo[] = [
      {
        code: 'E2 / H12.1',
        name: 'Pysäköintipaikka + Kiekko 2h',
        description: 'Pysäköintikiekko pakollinen arkisin klo 08–20. Aika max 2 tuntia.',
        iconType: 'disc'
      },
      {
        code: 'H18',
        name: 'Maksullinen pysäköinti (Vyöhyke 2)',
        description: 'EasyPark / ParkMan aluekoodi: 202 (2,00 € / tunti).',
        iconType: 'payment'
      },
      {
        code: 'C38 / C37',
        name: 'Pysäköintikieltoalue & Pelastusreitti',
        description: 'Pysäköinti sallittu vain merkityissä ruuduissa. Jalkakäytävälle tai aitaan nojaava pysäköinti sakotetaan heti.',
        iconType: 'no_parking'
      }
    ];

    const fineRisk: FineRiskInfo = {
      riskLevel: 'high',
      riskLabel: '🔴 Korkea valvontariski',
      riskRating1to10: 8,
      standardFineAmountEur: 80,
      fineType: 'Helsingin kaupungin pysäköintivirhemaksu (80 €)',
      criticalPitfalls: [
        'Kiekon unohtaminen tuulilasilta tai virheellinen saapumisaika',
        '2h aikarajan ylitys pitkissä peleissä tai tuplapelipäivänä',
        'Pysäköinti kadun keltaiselle sulkuviivalle tai pelastusväylälle',
        'Pysäköinti asukaspysäköintipaikalle ilman Z-tunnusta klo 17 jälkeen'
      ],
      preventionChecklist: [
        'Aseta kiekkoon seuraava tasa- tai puolitunti (esim. klo 17.30)',
        'Käytä EasyPark/ParkMan-sovellusta, jos peli ja venyttely kestävät yli 2h',
        'Varmista että auto on kokonaan maalattujen ruutumerkintöjen sisällä'
      ]
    };

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
      mapsNavigationUrl: `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`,
      spots,
      trafficSigns,
      fineRisk,
      easyParkZoneCode: '202',
      parkManZoneCode: '202'
    };
  }

  // 2. Suburban Dedicated Sports Parks (Pirkkola, Tapiola, Matinkylä, Leppävaara, Myyrmäki, Puotila, Käpylä, Kauppi, Kupittaa)
  if (
    lower.includes('pirkkola') ||
    lower.includes('matinkylä') ||
    lower.includes('tapiola') ||
    lower.includes('myyrmäki') ||
    lower.includes('leppävaara') ||
    lower.includes('puotila') ||
    lower.includes('käpylä') ||
    lower.includes('kauppi') ||
    lower.includes('kupittaa') ||
    lower.includes('olari') ||
    lower.includes('mosahalli') ||
    lower.includes('töölönlahti')
  ) {
    const spots: ParkingZoneSpot[] = [
      {
        id: 'p1',
        name: `P1: ${venueName} Pääparkkialue (Asfalttiruudut)`,
        type: 'standard',
        typeLabel: 'Pääparkkialue',
        capacityEstimated: 120,
        restrictionText: 'Maksuton, pysäköintikiekko 4h',
        discRequired: true,
        maxHours: 4,
        walkingTimeMinutes: 2,
        isRecommended: true
      },
      {
        id: 'p2',
        name: 'P2: Hiekkakentän ylivuotopysäköinti',
        type: 'standard',
        typeLabel: 'Lisäparkkialue',
        capacityEstimated: 80,
        restrictionText: 'Käytössä turnauspäivinä ja ruuhka-aikoina',
        discRequired: true,
        maxHours: 4,
        walkingTimeMinutes: 4
      },
      {
        id: 'p_ev',
        name: 'P3: Sähköautojen Type2-latauspaikat',
        type: 'ev',
        typeLabel: 'Latausruudut',
        capacityEstimated: 4,
        restrictionText: 'Vain latauksessa oleville ajoneuvoille (max 3h)',
        discRequired: false,
        maxHours: 3,
        walkingTimeMinutes: 2
      },
      {
        id: 'p_inv',
        name: 'P4: Esteettömät invapaikat (Hallin sisäänkäynti)',
        type: 'accessible',
        typeLabel: 'Invapaikat',
        capacityEstimated: 4,
        restrictionText: 'Vain liikkumisesteisen pysäköintitunnuksella',
        discRequired: false,
        walkingTimeMinutes: 1
      },
      {
        id: 'p_kielto',
        name: 'Huoltotie ja kentän huoltoportin edusta',
        type: 'no_parking',
        typeLabel: 'Pysäköintikielto',
        restrictionText: 'Pelastusväylä – Pysäköinti ehdottomasti kielletty',
        discRequired: false,
        walkingTimeMinutes: 0
      }
    ];

    const trafficSigns: TrafficSignInfo[] = [
      {
        code: 'E2 / H12.1',
        name: 'Pysäköintipaikka + Kiekko 4h',
        description: 'Maksuton pysäköinti kiekolla enintään 4 tuntia kerrallaan.',
        iconType: 'disc'
      },
      {
        code: 'C37',
        name: 'Pysäköinti kielletty',
        description: 'Voimassa huoltotien kääntöpaikalla ja puiston nurmialueilla.',
        iconType: 'no_parking'
      },
      {
        code: 'H14',
        name: 'Sähköajoneuvon latauspaikka',
        description: 'Ruudut varattu vain latauksessa oleville autoille latausajan.',
        iconType: 'ev'
      }
    ];

    const fineRisk: FineRiskInfo = {
      riskLevel: isRushHour ? 'moderate' : 'low',
      riskLabel: isRushHour ? '🟡 Kohtalainen valvontariski' : '🟢 Matala valvontariski',
      riskRating1to10: isRushHour ? 5 : 2,
      standardFineAmountEur: 60,
      fineType: 'Kunnallinen pysäköinninvalvonta / Yksityinen valvontamaksu (60–80 €)',
      criticalPitfalls: [
        'Kiekon asettamisen unohtaminen autoon jätettäessä',
        'Pysäköinti ruutujen ulkopuolelle nurmikolle tai pientareelle ruuhkassa',
        'Auton jättäminen saattoliikenteen kääntöpaikalle pelin ajaksi',
        'Sähköautorudussa seisominen ilman aktiivista latausta'
      ],
      preventionChecklist: [
        'Laita pysäköintikiekko heti autosta poistuessa',
        'Käytä hiekkakentän lisäpaikkoja jos asfalttiruudut ovat täynnä',
        'Älä tuki huoltoporttia tai pelastustietä'
      ]
    };

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
      mapsNavigationUrl: `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`,
      spots,
      trafficSigns,
      fineRisk
    };
  }

  // 3. Default Moderate Sports Venue
  const defaultSpots: ParkingZoneSpot[] = [
    {
      id: 'p1',
      name: 'P1: Urheilupuiston merkityt asfalttiruudut',
      type: 'standard',
      typeLabel: 'Pääalue',
      capacityEstimated: 50,
      restrictionText: 'Pysäköintikiekko 2h-4h',
      discRequired: true,
      maxHours: 3,
      walkingTimeMinutes: 3,
      isRecommended: true
    },
    {
      id: 'p2',
      name: 'P2: Kadunvarsipysäköinti',
      type: 'street',
      typeLabel: 'Kadunvarsi',
      capacityEstimated: 25,
      restrictionText: 'Tarkista liikennemerkkien aikarajoitus',
      discRequired: true,
      maxHours: 2,
      walkingTimeMinutes: 4
    },
    {
      id: 'p_danger',
      name: 'Pelastusväylä ja kääntöpaikka',
      type: 'no_parking',
      typeLabel: 'Pysäköintikielto',
      restrictionText: 'Pysäköinti kielletty',
      discRequired: false,
      walkingTimeMinutes: 0
    }
  ];

  const defaultSigns: TrafficSignInfo[] = [
    {
      code: 'E2 / H12.1',
      name: 'Pysäköintipaikka + Kiekko',
      description: 'Pysäköintikiekko vaaditaan arkisin ja viikonloppuisin.',
      iconType: 'disc'
    },
    {
      code: 'C37',
      name: 'Pysäköinti kielletty',
      description: 'Voimassa kääntöpaikalla ja pelastustiellä.',
      iconType: 'no_parking'
    }
  ];

  const defaultFineRisk: FineRiskInfo = {
    riskLevel: 'moderate',
    riskLabel: '🟡 Kohtalainen valvontariski',
    riskRating1to10: 4,
    standardFineAmountEur: 60,
    fineType: 'Pysäköinninvalvontamaksu (60 €)',
    criticalPitfalls: [
      'Pysäköintikiekon puuttuminen',
      'Pysäköinti ruutumerkintöjen ulkopuolelle tai pelastustielle',
      'Aikarajan ylitys turnauspäivänä'
    ],
    preventionChecklist: [
      'Aseta kiekko aina saapuessa',
      'Varmista että auto on kokonaan merkityssä ruudussa'
    ]
  };

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
    mapsNavigationUrl: `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`,
    spots: defaultSpots,
    trafficSigns: defaultSigns,
    fineRisk: defaultFineRisk
  };
}

