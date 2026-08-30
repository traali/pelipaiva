import { PitchSurface, VenueInfo } from '../../types/matchday';
import { db } from '../storage/db';
import { proxiedUrl } from '../api/proxyUrl';

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
  'lauttasaari tn b': { name: 'Lauttasaari TN B', lat: 60.16357, lng: 24.86750, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'lauttasaari tn a': { name: 'Lauttasaari TN A', lat: 60.16357, lng: 24.86750, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'lauttasaari tn': { name: 'Lauttasaaren tekonurmi', lat: 60.16357, lng: 24.86750, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'lauttasaari': { name: 'Lauttasaaren urheilukenttä', lat: 60.16357, lng: 24.86750, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'hansavalkama': { name: 'Hansavalkama TN', lat: 60.19083, lng: 24.58667, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'hansavalkama tn a': { name: 'Hansavalkama TN A', lat: 60.19083, lng: 24.58667, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'kaitaa tn': { name: 'Kaitaa TN', lat: 60.14863, lng: 24.69589, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'kaitaa tn a': { name: 'Kaitaa TN A', lat: 60.14863, lng: 24.69589, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'koskelantie': { name: 'Koskelantie nap TN', lat: 60.20193, lng: 24.94491, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'ruukinlahti': { name: 'Ruukinlahti nap TN', lat: 60.16197, lng: 24.86975, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'pirkkola tn': { name: 'Pirkkolan tekonurmi', lat: 60.2342, lng: 24.9205, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'pirkkola tn b': { name: 'Pirkkola TN B', lat: 60.2342, lng: 24.9205, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'kallio tn': { name: 'Kallion tekonurmi', lat: 60.1878, lng: 24.9518, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'kallio tn b': { name: 'Kallio TN B', lat: 60.1878, lng: 24.9518, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'espoonlahti tn': { name: 'Espoonlahden tekonurmi', lat: 60.1485, lng: 24.6530, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'espoonlahti 1 tn a': { name: 'Espoonlahti 1 TN A', lat: 60.1485, lng: 24.6530, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'töölö pk 3': { name: 'Töölön Pallokenttä 3', lat: 60.1878, lng: 24.9242, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'matinkylä 2 tn b': { name: 'Matinkylän Urheilupuisto TN 2 B', lat: 60.15859, lng: 24.75067, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'keski espoo 2 tn b': { name: 'Keski-Espoo 2 TN B', lat: 60.20927, lng: 24.67705, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },

  // === HELSINKI ===
  'bubu': { name: 'Puotilan Tekonurmi (Bubu)', lat: 60.2132, lng: 25.1098, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'puotila tn': { name: 'Puotilan Tekonurmi', lat: 60.2132, lng: 25.1098, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'väiski': { name: 'Väinämöisen kenttä (Väiski)', lat: 60.1741, lng: 24.9192, isIndoor: false, surface: 'sand_artificial_turf', hasFloodlights: true },
  'väinämöinen tn': { name: 'Väinämöisen kenttä', lat: 60.1741, lng: 24.9192, isIndoor: false, surface: 'sand_artificial_turf', hasFloodlights: true },
  'sahara': { name: 'Töölön Sahara Tekonurmi', lat: 60.1882, lng: 24.9254, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'bollis': { name: 'Töölön Pallokenttä 1 (Bollis)', lat: 60.1872, lng: 24.9248, isIndoor: false, surface: 'natural_grass', hasFloodlights: true },
  'bollis 1': { name: 'Töölön Pallokenttä 1 (Bollis)', lat: 60.1872, lng: 24.9248, isIndoor: false, surface: 'natural_grass', hasFloodlights: true },
  'bollis 2': { name: 'Töölön Pallokenttä 2', lat: 60.1878, lng: 24.9242, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'bollis 6': { name: 'Töölön Pallokenttä 6', lat: 60.1891, lng: 24.9231, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'töölön pk 1': { name: 'Töölön Pallokenttä 1', lat: 60.1872, lng: 24.9248, isIndoor: false, surface: 'natural_grass', hasFloodlights: true },
  'töölön pk 2': { name: 'Töölön Pallokenttä 2', lat: 60.1878, lng: 24.9242, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'töölön pk 6': { name: 'Töölön Pallokenttä 6', lat: 60.1891, lng: 24.9231, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'töölö pk 6': { name: 'Töölön Pallokenttä 6', lat: 60.1891, lng: 24.9231, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'töölön pk 7': { name: 'Töölön Pallokenttä 7', lat: 60.1895, lng: 24.9225, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'brahenkenttä': { name: 'Brahenkenttä (Braku)', lat: 60.1878, lng: 24.9518, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'braku': { name: 'Brahenkenttä (Braku)', lat: 60.1878, lng: 24.9518, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'käpylä tn 1': { name: 'Käpylän Urheilupuisto TN 1', lat: 60.2135, lng: 24.9452, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'käpylä tn 2': { name: 'Käpylän Urheilupuisto TN 2', lat: 60.2142, lng: 24.9445, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'käpa kupla': { name: 'Käpylän Kuplahalli', lat: 60.2140, lng: 24.9460, isIndoor: true, surface: 'artificial_turf_3g', hasFloodlights: true },
  'kupla': { name: 'Käpylän Kuplahalli', lat: 60.2140, lng: 24.9460, isIndoor: true, surface: 'artificial_turf_3g', hasFloodlights: true },
  'töölön kisahalli': { name: 'Töölön Kisahalli (Kisis)', lat: 60.1835, lng: 24.9282, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'kisis': { name: 'Töölön Kisahalli (Kisis)', lat: 60.1835, lng: 24.9282, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'lauttasaaren yhteiskoulu': { name: 'Lauttasaaren yhteiskoulu (LYK)', lat: 60.1601, lng: 24.8785, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'lauttasaaren yhteiskoulu uusi': { name: 'Lauttasaaren yhteiskoulu Uusi (LYK)', lat: 60.1601, lng: 24.8785, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'lauttasaaren yhteiskoulun uusi': { name: 'Lauttasaaren yhteiskoulu Uusi (LYK)', lat: 60.1601, lng: 24.8785, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'lyk': { name: 'Lauttasaaren yhteiskoulu (LYK)', lat: 60.1601, lng: 24.8785, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'lyk uusi': { name: 'Lauttasaaren yhteiskoulu Uusi (LYK)', lat: 60.1601, lng: 24.8785, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'lyk vanha': { name: 'Lauttasaaren yhteiskoulu Vanha (LYK)', lat: 60.1601, lng: 24.8785, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'esport center': { name: 'Esport Center Tapiola', lat: 60.1756, lng: 24.8054, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'esport center 2': { name: 'Esport Center 2', lat: 60.1756, lng: 24.8054, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'esport tapiola': { name: 'Esport Center Tapiola', lat: 60.1756, lng: 24.8054, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'munkkiniemen yhteiskoulu': { name: 'Munkkiniemen yhteiskoulu (MYK)', lat: 60.1965, lng: 24.8758, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'myk': { name: 'Munkkiniemen yhteiskoulu (MYK)', lat: 60.1965, lng: 24.8758, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'munkka': { name: 'Munkkiniemen yhteiskoulu', lat: 60.1965, lng: 24.8758, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'pohjois haagan yhteiskoulu': { name: 'Pohjois-Haagan yhteiskoulu (PHYK)', lat: 60.2235, lng: 24.8967, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'phyk': { name: 'Pohjois-Haagan yhteiskoulu (PHYK)', lat: 60.2235, lng: 24.8967, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'suomalainen yhteiskoulu': { name: 'Suomalainen yhteiskoulu (SYK)', lat: 60.1925, lng: 24.8968, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'syk': { name: 'Suomalainen yhteiskoulu (SYK)', lat: 60.1925, lng: 24.8968, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'namika areena': { name: 'Namika Areena Pakila', lat: 60.2450, lng: 24.9350, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'helsingin urheilutalo': { name: 'Helsingin Urheilutalo (Kallio)', lat: 60.1873, lng: 24.9525, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'urheilutalo': { name: 'Helsingin Urheilutalo (Kallio)', lat: 60.1873, lng: 24.9525, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'malmin palloiluhalli': { name: 'Malmin Palloiluhalli', lat: 60.2525, lng: 25.0125, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'herttoniemenrannan liikuntahalli': { name: 'Herttoniemenrannan Liikuntahalli', lat: 60.1912, lng: 25.0341, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'otahalli': { name: 'Otahalli Otaniemi', lat: 60.1850, lng: 24.8320, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'leppävaaran liikuntahalli': { name: 'Leppävaaran Liikuntahalli', lat: 60.2225, lng: 24.8085, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'mosahalli': { name: 'Tapanilan Mosahalli', lat: 60.2612, lng: 25.0234, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'mosahalli 1': { name: 'Tapanilan Mosahalli 1', lat: 60.2612, lng: 25.0234, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'mosahalli 2': { name: 'Tapanilan Mosahalli 2', lat: 60.2612, lng: 25.0234, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'johari': { name: 'Johanneksenkenttä', lat: 60.1612, lng: 24.9441, isIndoor: false, surface: 'sand_artificial_turf', hasFloodlights: true },
  'johanneksenkenttä': { name: 'Johanneksenkenttä', lat: 60.1612, lng: 24.9441, isIndoor: false, surface: 'sand_artificial_turf', hasFloodlights: true },
  'ogeli tn': { name: 'Oulunkylän Tekonurmi', lat: 60.2285, lng: 24.9654, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'oulunkylä tn': { name: 'Oulunkylän Tekonurmi', lat: 60.2285, lng: 24.9654, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'mustapekka areena': { name: 'Mustapekka Areena Oulunkylä', lat: 60.2285, lng: 24.9654, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'pitsku tn': { name: 'Pitäjänmäen Tekonurmi', lat: 60.2241, lng: 24.8612, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'pitäjänmäki tn': { name: 'Pitäjänmäen Tekonurmi', lat: 60.2241, lng: 24.8612, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'siltamäki tn': { name: 'Siltamäen Tekonurmi', lat: 60.2741, lng: 24.9812, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'kontula tn': { name: 'Kontulan Tekonurmi', lat: 60.2372, lng: 25.0841, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'rannikkorata tn': { name: 'Kontulan Rannikkotien TN', lat: 60.2372, lng: 25.0841, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'myllypuro tn': { name: 'Myllypuron Tekonurmi', lat: 60.2251, lng: 25.0441, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'arena center myllypuro': { name: 'Arena Center Myllypuro', lat: 60.2245, lng: 25.0435, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'arena center': { name: 'Arena Center Myllypuro', lat: 60.2245, lng: 25.0435, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'arena center kenttä 6': { name: 'Arena Center Myllypuro (Kenttä 6)', lat: 60.2245, lng: 25.0435, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'arena center kenttä 1': { name: 'Arena Center Myllypuro (Kenttä 1)', lat: 60.2245, lng: 25.0435, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'arena center kenttä 2': { name: 'Arena Center Myllypuro (Kenttä 2)', lat: 60.2245, lng: 25.0435, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'arena center kenttä 3': { name: 'Arena Center Myllypuro (Kenttä 3)', lat: 60.2245, lng: 25.0435, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'arena center kenttä 4': { name: 'Arena Center Myllypuro (Kenttä 4)', lat: 60.2245, lng: 25.0435, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'arena center kenttä 5': { name: 'Arena Center Myllypuro (Kenttä 5)', lat: 60.2245, lng: 25.0435, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'arena center ruskeasuo': { name: 'Arena Center Ruskeasuo', lat: 60.2012, lng: 24.9012, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'arena center hakaniemi': { name: 'Arena Center Hakaniemi', lat: 60.1795, lng: 24.9512, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'arena center kaarela': { name: 'Arena Center Kaarela', lat: 60.2512, lng: 24.8812, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'hertsu tn': { name: 'Herttoniemenrannan Tekonurmi', lat: 60.1912, lng: 25.0341, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'herttoniemi tn': { name: 'Herttoniemenrannan Tekonurmi', lat: 60.1912, lng: 25.0341, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'hetemiitty': { name: 'Vuosaaren Heteniitty (Hetari)', lat: 60.2112, lng: 25.1412, isIndoor: false, surface: 'natural_grass', hasFloodlights: true },
  'hetari': { name: 'Vuosaaren Heteniitty (Hetari)', lat: 60.2112, lng: 25.1412, isIndoor: false, surface: 'natural_grass', hasFloodlights: true },
  'kartano tn': { name: 'Vuosaaren Kartanon Tekonurmi', lat: 60.2185, lng: 25.1491, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'jakomäki tn': { name: 'Jakomäen Tekonurmi', lat: 60.2612, lng: 25.0781, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'puistola tn': { name: 'Puistolan Tekonurmi', lat: 60.2781, lng: 25.0412, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'tapuli tn': { name: 'Tapulin Tekonurmi', lat: 60.2751, lng: 25.0312, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'tapuli nap': { name: 'Tapulin tekonurmi', lat: 60.2751, lng: 25.0312, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'tapuli': { name: 'Tapulin tekonurmi', lat: 60.2751, lng: 25.0312, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'laajasalo tn': { name: 'Laajasalon Tekonurmi', lat: 60.1781, lng: 25.0412, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'jätkäsaari tn': { name: 'Jätkäsaaren Tekonurmi', lat: 60.1581, lng: 24.9181, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'talin halli': { name: 'Talin Jalkapallohalli', lat: 60.2141, lng: 24.8612, isIndoor: true, surface: 'artificial_turf_3g', hasFloodlights: true },
  'tali tn': { name: 'Talin Tekonurmi', lat: 60.2145, lng: 24.8625, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'tali': { name: 'Talin Urheilupuisto', lat: 60.2141, lng: 24.8612, isIndoor: true, surface: 'artificial_turf_3g', hasFloodlights: true },
  'hernesaaren kupla': { name: 'Hernesaaren Kuplahalli', lat: 60.1512, lng: 24.9241, isIndoor: true, surface: 'artificial_turf_3g', hasFloodlights: true },
  'pukinmäki tn': { name: 'Pukinmäen Tekonurmi', lat: 60.2481, lng: 24.9981, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'malmi palloiluhalli': { name: 'Malmin Palloiluhalli', lat: 60.2512, lng: 25.0141, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'urhea halli': { name: 'Urhea-halli Vallila', lat: 60.1981, lng: 24.9541, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'lehto areena': { name: 'Lehto Areena PuMa', lat: 60.2412, lng: 25.0112, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'lehto areena 1': { name: 'Lehto Areena 1', lat: 60.2412, lng: 25.0112, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },

  // === ESPOO & KAUNIAINEN ===
  'matinkylä tn 1': { name: 'Matinkylän Urheilupuisto TN 1', lat: 60.1582, lng: 24.7505, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'matinkylä tn 2': { name: 'Matinkylän Urheilupuisto TN 2', lat: 60.1578, lng: 24.7512, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'matinari': { name: 'Matinkylän Tekonurmi (Matinari)', lat: 60.1582, lng: 24.7505, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'tapiola tn 1': { name: 'Tapiolan Urheilupuisto TN 1', lat: 60.1785, lng: 24.7865, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'tapiola 1 tn': { name: 'Tapiolan Urheilupuisto TN 1', lat: 60.1785, lng: 24.7865, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'tapiola tn 2': { name: 'Tapiolan Urheilupuisto TN 2', lat: 60.1790, lng: 24.7872, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'honkahalli': { name: 'Honkahalli Tapiola', lat: 60.1792, lng: 24.7880, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'honkahalli 1': { name: 'Honkahalli 1', lat: 60.1792, lng: 24.7880, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'honkahalli 2': { name: 'Honkahalli 2', lat: 60.1792, lng: 24.7880, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'esport arena': { name: 'Esport Arena Tapiola', lat: 60.1775, lng: 24.7850, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'esport rink': { name: 'Esport Rink Tapiola', lat: 60.1775, lng: 24.7850, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'leppävaara tn': { name: 'Leppävaaran Urheilupuisto TN', lat: 60.2240, lng: 24.8105, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'lepuski tn': { name: 'Leppävaaran Tekonurmi (Lepuski)', lat: 60.2240, lng: 24.8105, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'keski-espoo tn': { name: 'Keski-Espoon Tekonurmi (EBK Park)', lat: 60.2081, lng: 24.6612, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'ebk park': { name: 'EBK Park Keski-Espoo', lat: 60.2081, lng: 24.6612, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'kameleonten': { name: 'Kameleonten Areena Leppävaara', lat: 60.2260, lng: 24.8120, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'otaniemi tn': { name: 'Otaniemen Tekonurmi (Otaranta)', lat: 60.1841, lng: 24.8312, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'laaksolahti tn': { name: 'Laaksolahden Tekonurmi', lat: 60.2412, lng: 24.7612, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'karakallio tn': { name: 'Karakallion Tekonurmi', lat: 60.2351, lng: 24.7741, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'kivenlahti tn': { name: 'Kivenlahden Tekonurmi', lat: 60.1512, lng: 24.6412, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'grani tn': { name: 'Kauniaisten Keskuskenttä TN (Grani)', lat: 60.2112, lng: 24.7241, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'kauniainen tn': { name: 'Kauniaisten Keskuskenttä TN', lat: 60.2112, lng: 24.7241, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },

  // === VANTAA ===
  'myyrmäki jalkapallostadion': { name: 'Myyrmäen Jalkapallostadion', lat: 60.2625, lng: 24.8510, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'myyrmäki stadion': { name: 'Myyrmäen Jalkapallostadion', lat: 60.2625, lng: 24.8510, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'energia areena': { name: 'Vantaan Energia Areena', lat: 60.2642, lng: 24.8528, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'arena center myyrmäki': { name: 'Arena Center Myyrmäki', lat: 60.2610, lng: 24.8540, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'tikkurila tn': { name: 'Tikkurilan Urheilupuisto TN', lat: 60.2981, lng: 25.0412, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'tikkurila kupla': { name: 'Tikkurilan Kuplahalli', lat: 60.2985, lng: 25.0425, isIndoor: true, surface: 'artificial_turf_3g', hasFloodlights: true },
  'havukoski tn': { name: 'Havukosken Tekonurmi', lat: 60.3141, lng: 25.0612, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'peakfin areena': { name: 'Peakfin Areena Vantaa', lat: 60.2812, lng: 24.8641, isIndoor: true, surface: 'artificial_turf_3g', hasFloodlights: true },
  'jokivarsi tn': { name: 'Jokivarren Tekonurmi', lat: 60.3612, lng: 25.1241, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'hiekkaharju tn': { name: 'Hiekkaharjun Tekonurmi', lat: 60.3012, lng: 25.0512, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },

  // === TAMPERE & PIRKANMAA ===
  'kauppi tn 1': { name: 'Tampereen Kaupin Urheilupuisto TN 1', lat: 61.5034, lng: 23.8052, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'kauppi tn 2': { name: 'Tampereen Kaupin Urheilupuisto TN 2', lat: 61.5040, lng: 23.8060, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'kauppi': { name: 'Tampereen Kaupin Urheilupuisto', lat: 61.5034, lng: 23.8052, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'tammela stadion': { name: 'Tammelan Stadion Tampere', lat: 61.4985, lng: 23.7812, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'ratina stadion': { name: 'Ratinan Stadion Tampere', lat: 61.4932, lng: 23.7645, isIndoor: false, surface: 'natural_grass', hasFloodlights: true },
  'pyynikki': { name: 'Pyynikin Urheilukenttä', lat: 61.4941, lng: 23.7381, isIndoor: false, surface: 'sand_artificial_turf', hasFloodlights: true },
  'ahvenisjärvi tn': { name: 'Ahvenisjärven Tekonurmi Hervanta', lat: 61.4481, lng: 23.8481, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'hervanta tn': { name: 'Hervannan Tekonurmi', lat: 61.4481, lng: 23.8481, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'ikuri halli': { name: 'Ikurin Liikuntahalli Tampere', lat: 61.5112, lng: 23.6141, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'pispala tn': { name: 'Pispalan Tekonurmi', lat: 61.5012, lng: 23.7141, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },

  // === TURKU & VARSINAIS-SUOMI ===
  'kupittaa 5': { name: 'Turun Kupittaan Tekonurmi 5', lat: 60.4430, lng: 22.2885, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'kupittaa 1': { name: 'Turun Kupittaan Tekonurmi 1', lat: 60.4435, lng: 22.2870, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'kupittaa 2': { name: 'Turun Kupittaan Tekonurmi 2', lat: 60.4438, lng: 22.2875, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'kupittaa tn': { name: 'Turun Kupittaan Tekonurmi', lat: 60.4430, lng: 22.2885, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'kupittaa palloiluhalli': { name: 'Kupittaan Palloiluhalli Turku', lat: 60.4420, lng: 22.2890, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'veritas stadion': { name: 'Veritas Stadion Turku', lat: 60.4428, lng: 22.2905, isIndoor: false, surface: 'natural_grass', hasFloodlights: true },
  'yläkenttä': { name: 'Turun Urheilupuiston Yläkenttä', lat: 60.4475, lng: 22.2612, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'parkinkenttä': { name: 'Parkinkenttä Turku', lat: 60.4561, lng: 22.2681, isIndoor: false, surface: 'sand_artificial_turf', hasFloodlights: true },
  'impivaara halli': { name: 'Impivaaran Jalkapallohalli', lat: 60.4781, lng: 22.2841, isIndoor: true, surface: 'artificial_turf_3g', hasFloodlights: true },

  // === JYVÄSKYLÄ ===
  'vehkalampi tn': { name: 'Jyväskylän Vehkalammen Tekonurmi', lat: 62.2355, lng: 25.7198, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'vehkalampi': { name: 'Jyväskylän Vehkalammen Tekonurmi', lat: 62.2355, lng: 25.7198, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'huhtasuo tn': { name: 'Huhtasuon Tekonurmi Jyväskylä', lat: 62.2641, lng: 25.7941, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'viitaniemi tn': { name: 'Viitaniemen Tekonurmi Jyväskylä', lat: 62.2481, lng: 25.7312, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'hipposhalli': { name: 'Hipposhalli Jyväskylä', lat: 62.2341, lng: 25.7212, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'harju stadion': { name: 'Harjun Stadion Jyväskylä', lat: 62.2441, lng: 25.7381, isIndoor: false, surface: 'natural_grass', hasFloodlights: true },

  // === OULU ===
  'heinäpää tn': { name: 'Oulun Heinäpään Tekonurmi', lat: 65.0032, lng: 25.4542, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'heinis': { name: 'Oulun Heinäpään Tekonurmi (Heinis)', lat: 65.0032, lng: 25.4542, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'heinäpään palloiluhalli': { name: 'Heinäpään Jalkapallohalli Oulu', lat: 65.0035, lng: 25.4550, isIndoor: true, surface: 'artificial_turf_3g', hasFloodlights: true },
  'castren': { name: 'Oulun Castrenin Tekonurmi', lat: 65.0180, lng: 25.4850, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'raatti stadion': { name: 'Raatin Stadion Oulu', lat: 65.0185, lng: 25.4612, isIndoor: false, surface: 'natural_grass', hasFloodlights: true },
  'ouluhalli': { name: 'Ouluhalli', lat: 65.0091, lng: 25.4981, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'garam masala areena': { name: 'Garam Masala Areena Oulu', lat: 65.0038, lng: 25.4548, isIndoor: true, surface: 'artificial_turf_3g', hasFloodlights: true },

  // === LAHTI ===
  'kisapuisto tn': { name: 'Lahden Kisapuiston Tekonurmi', lat: 60.9850, lng: 25.6540, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'kisapuisto': { name: 'Lahden Kisapuisto', lat: 60.9850, lng: 25.6540, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'mukkula halli': { name: 'Mukkulan Kuplahalli Lahti', lat: 61.0112, lng: 25.6612, isIndoor: true, surface: 'artificial_turf_3g', hasFloodlights: true },
  'lahti stadion': { name: 'Lahden Stadion', lat: 60.9812, lng: 25.6381, isIndoor: false, surface: 'natural_grass', hasFloodlights: true },
  'suurhalli lahti': { name: 'Lahden Suurhalli', lat: 60.9825, lng: 25.6412, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },

  // === KUOPIO & POHJOIS-SAVO ===
  'väre areena': { name: 'Väre Areena Kuopio (Keskuskenttä)', lat: 62.8875, lng: 27.6712, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'kuopio keskuskenttä': { name: 'Väre Areena Kuopio', lat: 62.8875, lng: 27.6712, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'lippumäki halli': { name: 'Lippumäen Ylipainehalli Kuopio', lat: 62.8481, lng: 27.6341, isIndoor: true, surface: 'artificial_turf_3g', hasFloodlights: true },
  'lippumäki tn': { name: 'Lippumäen Tekonurmi', lat: 62.8485, lng: 27.6350, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },

  // === ROVANIEMI & LAPPI ===
  'suskun tn': { name: 'Rovaniemen Keskuskenttä (Suskun TN)', lat: 66.4981, lng: 25.7241, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'rovaniemi keskuskenttä': { name: 'Rovaniemen Keskuskenttä', lat: 66.4981, lng: 25.7241, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'ounashalli': { name: 'Ounashalli Rovaniemi', lat: 66.5141, lng: 25.7612, isIndoor: true, surface: 'artificial_turf_3g', hasFloodlights: true },

  // === NATIONAL SPORTS INSTITUTES ===
  'eerikkilä': { name: 'Eerikkilän Urheiluopisto', lat: 60.7785, lng: 23.7541, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'eerikkilä tn 1': { name: 'Eerikkilän Urheiluopisto TN 1', lat: 60.7785, lng: 23.7541, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'pajulahti': { name: 'Pajulahden Urheiluopisto', lat: 60.9612, lng: 25.9341, isIndoor: false, surface: 'artificial_turf_3g', hasFloodlights: true },
  'kuortane': { name: 'Kuortaneen Urheiluopisto', lat: 62.8112, lng: 23.5112, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'vierumäki': { name: 'Vierumäen Urheiluopisto', lat: 61.1141, lng: 26.0112, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },

  // === MULTI-SPORT HALLS (salibandy, koripallo, lentopallo, jääkiekko) ===
  'helsinki jäähalli': { name: 'Helsingin Jäähalli (Nordis)', lat: 60.1892, lng: 24.9225, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'nordis': { name: 'Helsingin Jäähalli (Nordis)', lat: 60.1892, lng: 24.9225, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'jäähalli': { name: 'Helsingin Jäähalli', lat: 60.1892, lng: 24.9225, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'pirkkola jäähalli': { name: 'Pirkkolan jäähalli', lat: 60.2348, lng: 24.9201, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'vantaa jäähalli': { name: 'Tikkurilan jäähalli', lat: 60.2984, lng: 25.0372, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'haagan palloiluhalli': { name: 'Haagan palloiluhalli', lat: 60.2156, lng: 24.9004, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'meilahti liikuntahalli': { name: 'Meilahden liikuntahalli', lat: 60.1908, lng: 24.9075, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'myllypuro palloiluhalli': { name: 'Myllypuron palloiluhalli', lat: 60.2238, lng: 25.0774, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'unihalli': { name: 'Tampereen Unihalli', lat: 61.4985, lng: 23.7612, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'tampereen unihalli': { name: 'Tampereen Unihalli', lat: 61.4985, lng: 23.7612, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'espoo metsäkallio': { name: 'Tapiolan urheiluhalli', lat: 60.1778, lng: 24.8062, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'tapiolan urheiluhalli': { name: 'Tapiolan urheiluhalli', lat: 60.1778, lng: 24.8062, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'leppävaara liikuntahalli': { name: 'Leppävaaran liikuntahalli', lat: 60.2194, lng: 24.8135, isIndoor: true, surface: 'indoor_parquet', hasFloodlights: true },
  'sellon salibandy': { name: 'Leppävaaran liikuntahalli', lat: 60.2194, lng: 24.8135, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'paradice': { name: 'Paradice-jäähalli Vuosaari', lat: 60.2075, lng: 25.1441, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true },
  'vuosaari jäähalli': { name: 'Paradice-jäähalli Vuosaari', lat: 60.2075, lng: 25.1441, isIndoor: true, surface: 'indoor_synthetic', hasFloodlights: true }
};

function matchesAliasWord(text: string, alias: string): boolean {
  if (text === alias) return true;
  // Whole phrase/word match with boundary spaces or string start/end
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'i');
  return regex.test(text);
}

export interface VenueResolveHint {
  lat?: number;
  lng?: number;
  city?: string;
}

function extractLipasPoint(site: Record<string, unknown>): { lat: number; lng: number } | null {
  const location = site.location as Record<string, unknown> | undefined;
  const geometries = location?.geometries as Record<string, unknown> | undefined;
  const features = geometries?.features as Array<Record<string, unknown>> | undefined;
  const coords = features?.[0]?.geometry
    ? ((features[0].geometry as Record<string, unknown>).coordinates as number[] | undefined)
    : undefined;
  if (Array.isArray(coords) && coords.length >= 2) {
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return null;
}

function scoreName(siteName: string, query: string): number {
  const a = siteName.toLowerCase();
  const b = query.toLowerCase();
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80;
  const tokens = b.split(/\s+/).filter((t) => t.length > 2);
  const hits = tokens.filter((t) => a.includes(t)).length;
  return tokens.length ? (hits / tokens.length) * 60 : 0;
}

export async function resolveSportsVenue(
  rawVenueString: string,
  hint?: VenueResolveHint
): Promise<VenueInfo> {
  const normalized = (rawVenueString || '')
    .toLowerCase()
    .replace(/[\.,\-\/\(\)]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const indoorGuess = /halli|arena|center|sali|koulu|lukio|opisto|liikuntasali|monitoimitalo|gym|liikuntahalli/i.test(normalized);

  if (hint?.lat && hint?.lng) {
    const aliasHit = Object.entries(NATIONAL_FIELD_ALIASES)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([alias]) => matchesAliasWord(normalized, alias));
    return {
      name: aliasHit?.[1].name || rawVenueString,
      normalizedName: normalized,
      city: hint.city,
      coordinates: { lat: hint.lat, lng: hint.lng },
      isIndoor: aliasHit?.[1].isIndoor ?? indoorGuess,
      surface: aliasHit?.[1].surface ?? (indoorGuess ? 'indoor_parquet' : 'artificial_turf_3g'),
      hasFloodlights: aliasHit?.[1].hasFloodlights ?? true
    };
  }

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
    // outside browser
  }

  const sortedAliases = Object.entries(NATIONAL_FIELD_ALIASES).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [alias, data] of sortedAliases) {
    if (matchesAliasWord(normalized, alias)) {
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

  if (typeof fetch !== 'undefined' && rawVenueString) {
    try {
      const rawLipasUrl =
        'https://api.lipas.fi/v2/sports-sites?city-codes=91,49,92&type-codes=1110,1340,1350&page-size=200';
      const lipasUrl = typeof window !== 'undefined' ? proxiedUrl(rawLipasUrl) : rawLipasUrl;
      const res = await fetch(lipasUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const payload = await res.json();
        const items: Record<string, unknown>[] = Array.isArray(payload?.items) ? payload.items : [];
        let best: { site: Record<string, unknown>; score: number } | null = null;
        for (const site of items) {
          const score = scoreName(String(site.name || ''), rawVenueString);
          if (score >= 50 && (!best || score > best.score)) best = { site, score };
        }
        if (best) {
          const point = extractLipasPoint(best.site);
          if (point) {
            const typeName = String(
              (best.site.type as Record<string, unknown> | undefined)?.name ||
                (best.site.type as Record<string, unknown> | undefined)?.['type-code'] ||
                ''
            ).toLowerCase();
            const isIndoor = /halli|sali|areena/.test(typeName) || indoorGuess;
            const location = best.site.location as Record<string, unknown> | undefined;
            const city = location?.city as Record<string, unknown> | undefined;
            return {
              name: String(best.site.name || rawVenueString),
              normalizedName: normalized,
              address: location?.address as string | undefined,
              city: (city?.name as string) || undefined,
              postalCode: location?.['postal-code'] as string | undefined,
              coordinates: point,
              isIndoor,
              surface: isIndoor ? 'indoor_synthetic' : 'artificial_turf_3g',
              hasFloodlights: true,
              lipasId: Number(best.site['lipas-id']) || undefined
            };
          }
        }
      }
    } catch {
      // fallback
    }

    try {
      const rawHelUrl = `https://api.hel.fi/servicemap/v2/search/?q=${encodeURIComponent(rawVenueString)}&type=unit`;
      const pUrl = typeof window !== 'undefined' ? proxiedUrl(rawHelUrl) : rawHelUrl;
      const pRes = await fetch(pUrl, { signal: AbortSignal.timeout(5000) });
      if (pRes.ok) {
        const pJson = await pRes.json();
        const results: Array<Record<string, unknown>> = pJson.results || [];
        const sporty = results.find((top) => {
          const name = String((top.name as Record<string, string> | undefined)?.fi || '').toLowerCase();
          if (/patsas|veistos|muistomerkki|sculpture/.test(name)) return false;
          return /kenttä|tekonurmi|halli|puisto|urheilu|pallo|areena|tn\b/.test(name);
        });
        const top = sporty;
        const loc = top?.location as Record<string, unknown> | undefined;
        const coords = loc?.coordinates as number[] | undefined;
        if (top && coords && coords.length >= 2) {
          const [lng, lat] = coords;
          const nameObj = top.name as Record<string, string> | undefined;
          const addr = top.street_address as Record<string, string> | undefined;
          return {
            name: nameObj?.fi || rawVenueString,
            normalizedName: normalized,
            address: addr?.fi,
            coordinates: { lat: Number(lat), lng: Number(lng) },
            isIndoor: indoorGuess,
            surface: indoorGuess ? 'indoor_synthetic' : 'artificial_turf_3g',
            hasFloodlights: true
          };
        }
      }
    } catch {
      // fallback
    }
  }

  return {
    name: rawVenueString || 'Tuntematon kenttä',
    normalizedName: normalized,
    coordinates: { lat: 60.1872, lng: 24.9248 },
    // Flag the unverifiable fallback so UI can show "Sijainti arvioitu"
    // instead of presenting Helsinki as fact (M-15/V21).
    isApproximateLocation: true,
    isIndoor: indoorGuess,
    surface: indoorGuess ? 'indoor_synthetic' : 'artificial_turf_3g',
    hasFloodlights: true
  };
}

export const geocodeSportsVenue = resolveSportsVenue;
