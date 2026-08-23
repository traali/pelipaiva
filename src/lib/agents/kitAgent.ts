import type { FootwearRecommendation, MatchdayEvent, PlayerProfile, SportType } from '../../types/matchday';
import { determineFootwear } from '../ai/deterministicReasoner';
import type { KitItem, SportKitPlan } from './types';

const FOOTWEAR_FI: Record<FootwearRecommendation, string> = {
  AG_ARTIFICIAL_GRASS: 'AG-nappikset',
  FG_FIRM_GROUND: 'FG-nappikset',
  SG_SOFT_GROUND: 'SG-rautatapit',
  TF_TURF_SHOES: 'TF turf-kengät',
  INDOOR_NON_MARKING: 'Non-marking sisäpelikengät'
};

function item(id: string, label: string, why: string, required = true, weatherDriven = false): KitItem {
  return { id, label, why, required, weatherDriven };
}

function sportCore(sport: SportType, isTraining: boolean): KitItem[] {
  switch (sport) {
    case 'floorball':
      return [
        item('maila', 'Maila + varamaila', 'Salibandymaila katkeaa — vara aina kassissa.'),
        item('lasit', 'Suojalasit', 'Salibandyliitto suosittelee junioreille.'),
        item('kengat', 'Vaaleapohjaiset salikengät', 'Tumma pohja merkitsee parketin.'),
        item('paita', isTraining ? 'Treenipaita' : 'Pelipaita', 'Joukkueen paita päällä.'),
        item('juoma', 'Juomapullo', 'Sisähalli kuivattaa.')
      ];
    case 'basketball':
      return [
        item('kengat', 'Koripallokengät (sisä)', 'Nilkkatuki parketilla.'),
        item('paita', isTraining ? 'Treenipaita' : 'Pelipaita + shortsit', 'Ykköspaita kotiin, vieras mukaan.'),
        item('juoma', 'Juomapullo', 'Neljännesvuorot kuivattavat.'),
        item('teippi', 'Sormiteippi', 'Hyppääjän sormet.')
      ];
    case 'volleyball':
      return [
        item('kengat', 'Non-marking lentopallokengät', 'Parketti / sisäalusta.'),
        item('polvi', 'Polvisuojat', 'Puolustus ja syöttö.'),
        item('paita', isTraining ? 'Treenipaita' : 'Pelipaita', 'Liiton peliasu.'),
        item('juoma', 'Juomapullo', 'Erät pitkiä.')
      ];
    case 'icehockey':
      return [
        item('luistimet', 'Luistimet (teroitus kunnossa)', 'Aamujää: terät tarkistetaan illalla.'),
        item('kypärä', 'Kypärä + ristikko/visiiri', 'Pakollinen junioreilla.'),
        item('hanskat', 'Hanskat, säärisuojat, housut, hartiat', 'Täysi varustus joka vuorolle.'),
        item('maila', 'Maila + teippi', 'Varamaila jos mahtuu.'),
        item('juoma', 'Juomapullo (ei lasia)', 'Kopissa, ei laidalla lasia.')
      ];
    case 'futsal':
      return [
        item('kengat', 'Futsal-kengät (TF / non-marking)', 'Sali: ei nappuloita.'),
        item('saary', 'Säärystimet', 'Futsalissa säärisuojat ovat sääntö.'),
        item('paita', isTraining ? 'Treenipaita' : 'Pelipaita', 'Ykkönen tai vieras.'),
        item('juoma', 'Juomapullo', 'Lyhyet vaihdot, paljon juoksua.')
      ];
    case 'football':
    default:
      return [
        item('nappikset', 'Nappikset (katso Nappisvahti)', 'Alusta ratkaisee AG / FG / SG / TF.'),
        item('saary', 'Säärystimet + teippi', 'Palloliitto: säärisuojat ottelussa.'),
        item('paita', isTraining ? 'Treenipaita + shortsit' : 'Pelipaita (ykkönen / vieras)', 'Kotona ykkönen, vieraissa kakkospaita.'),
        item('juoma', 'Juomapullo', 'Ulkona myös talvella.'),
        item('pallo', isTraining ? 'Oma pallo jos valmentaja pyytää' : 'Ei omaa palloja otteluun', 'Ottelussa joukkueen pallot.')
      ];
  }
}

function weatherExtras(event: MatchdayEvent): KitItem[] {
  const extras: KitItem[] = [];
  const w = event.weather;
  if (event.venue.isIndoor) {
    extras.push(item('sisahalli', 'Sisäkengät kopissa', 'Ulkokengät pois salista.', true, false));
    return extras;
  }
  const temp = w?.isForecastLongRange ? undefined : w?.temperatureC;
  const rain = w?.isForecastLongRange ? 0 : w?.precipitationMmh ?? 0;
  if ((temp ?? 12) < 6) {
    extras.push(
      item('alus', 'Tekninen aluskerrasto + pipo', 'Ulkokenttä alle +6 °C.', true, true),
      item('hanskat', 'Ohuet pelihanskat', 'Sormet jäätyvät tekonurmella.', false, true)
    );
  }
  if (rain > 0.4) {
    extras.push(
      item('sade', 'Sadeasu / kuorikerros', 'Sade yli 0.4 mm/h — kassi märäksi ilman kuorta.', true, true)
    );
  }
  if ((temp ?? 12) < 2) {
    extras.push(item('vaihto', 'Vaihtoehtoinen kuiva paita', 'Jäätynyt paita pois heti pelin jälkeen.', true, true));
  }
  return extras;
}

function spectatorExtras(event: MatchdayEvent): KitItem[] {
  const items: KitItem[] = [item('katsomo', 'Säänmukainen katsomovarustus', 'Vanhempi seisoo 90 min.', true, false)];
  if (event.venue.isIndoor) {
    items.push(item('sisakenka', 'Sisäkengät halliin', 'Nappikset / ulkokengät jäävät aulaan.', true, false));
    return items;
  }
  const temp = event.weather?.isForecastLongRange ? undefined : event.weather?.temperatureC;
  const rain = event.weather?.isForecastLongRange ? 0 : event.weather?.precipitationMmh ?? 0;
  if ((temp ?? 12) < 8) {
    items.push(
      item('termos', 'Termos + istuinalusta', 'Kylmä katsomo, ei penkkiä.', true, true)
    );
  }
  if (rain > 0.3) {
    items.push(item('sateenvarjo', 'Sateenvarjo / sadetakki', 'Ulkokentän sivu.', true, true));
  }
  if (event.volunteerDuty) {
    items.push(item('vuoro', `Talkoovarustus: ${event.volunteerDuty}`, 'Saavu 15 min ennen vuoroa.', true, false));
  }
  return items;
}

export function buildSportKitPlan(event: MatchdayEvent, profile?: PlayerProfile): SportKitPlan {
  const { footwear, reason } = determineFootwear(
    event.venue.surface,
    event.weather?.isForecastLongRange ? 12 : event.weather?.temperatureC ?? 12,
    event.weather?.isForecastLongRange ? 0 : event.weather?.precipitationMmh ?? 0,
    event.venue.isIndoor
  );
  const kitSet: SportKitPlan['kitSet'] = event.isTraining
    ? 'treeni'
    : event.isHomeMatch
      ? 'ykkönen'
      : 'vieras';

  return {
    sport: event.sport,
    footwearLabel: FOOTWEAR_FI[footwear],
    footwearWhy: reason,
    kitSet,
    kitColors: {
      primary: profile?.colorHex || profile?.primaryColor || '#10b981',
      secondary: profile?.secondaryColor
    },
    playerItems: [...sportCore(event.sport, event.isTraining), ...weatherExtras(event)],
    spectatorItems: spectatorExtras(event)
  };
}

export function kitAgent(events: MatchdayEvent[], profiles: PlayerProfile[]): Record<string, SportKitPlan> {
  const out: Record<string, SportKitPlan> = {};
  for (const ev of events) {
    const profile = profiles.find((p) => p.id === ev.profileId);
    out[ev.id] = buildSportKitPlan(ev, profile);
  }
  return out;
}
