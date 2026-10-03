/**
 * Ugandan administrative places, used by the checkout shipping form.
 *
 * Uganda is organised into four regions, 146 districts, and beneath those a
 * mix of cities, municipalities, towns and ordinary district headquarters.
 * The kind is carried alongside each name because a rider needs to know
 * whether "Nansana" is a municipality or a district when reading a delivery
 * instruction.
 *
 * This is a curated list weighted towards the places a Kampala grocery
 * delivery actually serves. It is not the full 146 districts.
 */

export type PlaceKind = 'City' | 'Municipality' | 'Town' | 'District';

export type Place = {
  name: string;
  kind: PlaceKind;
};

export type UgandaRegion = {
  name: string;
  places: Place[];
};

const city = (name: string): Place => ({ name, kind: 'City' });
const municipality = (name: string): Place => ({ name, kind: 'Municipality' });
const town = (name: string): Place => ({ name, kind: 'Town' });
const district = (name: string): Place => ({ name, kind: 'District' });

export const UGANDA_REGIONS: UgandaRegion[] = [
  {
    name: 'Central Region',
    places: [
      city('Kampala'),
      municipality('Nansana'),
      municipality('Wakiso'),
      municipality('Mukono'),
      municipality('Mityana'),
      municipality('Mubende'),
      city('Masaka'),
      town('Buikwe'),
      town('Luwero'),
      town('Nakasongola'),
      town('Kayunga'),
      town('Rakai'),
      town('Kyotera'),
      town('Kalangala'),
      district('Buvuma'),
      district('Bukomansimbi'),
      district('Butambala'),
      district('Gomba'),
      district('Kalungu'),
      district('Kiboga'),
      district('Kyankwanzi'),
      district('Lwengo'),
      district('Lyantonde'),
      district('Mpigi'),
      district('Nakaseke'),
      district('Sembabule'),
    ],
  },
  {
    name: 'Eastern Region',
    places: [
      city('Jinja'),
      city('Mbale'),
      city('Soroti'),
      municipality('Tororo'),
      municipality('Iganga'),
      municipality('Busia'),
      town('Kapchorwa'),
      town('Kaberamaido'),
      town('Bugiri'),
      town('Namutumba'),
      town('Kamuli'),
      town('Pallisa'),
      town('Kalaki'),
      town('Amuria'),
      district('Bududa'),
      district('Bukedea'),
      district('Bukwa'),
      district('Bulambuli'),
      district('Buyende'),
      district('Butaleja'),
      district('Butebo'),
      district('Kibuku'),
      district('Kumi'),
      district('Kween'),
      district('Kapelebyong'),
      district('Luuka'),
      district('Manafwa'),
      district('Mayuge'),
      district('Namisindwa'),
      district('Ngora'),
      district('Serere'),
      district('Sironko'),
    ],
  },
  {
    name: 'Northern Region',
    places: [
      city('Gulu'),
      city('Lira'),
      city('Arua'),
      town('Adjumani'),
      town('Apac'),
      town('Kitgum'),
      town('Moyo'),
      town('Nebbi'),
      town('Nwoya'),
      town('Omoro'),
      town('Yumbe'),
      town('Zombo'),
      district('Abim'),
      district('Amolatar'),
      district('Amuru'),
      district('Amudat'),
      district('Dokolo'),
      district('Kaabong'),
      district('Karenga'),
      district('Kole'),
      district('Kwania'),
      district('Lamwo'),
      district('Madi-Okollo'),
      district('Maracha'),
      district('Oyam'),
      district('Pakwach'),
    ],
  },
  {
    name: 'Western Region',
    places: [
      city('Mbarara'),
      city('Fort Portal'),
      city('Hoima'),
      city('Kabale'),
      municipality('Kasese'),
      municipality('Masindi'),
      municipality('Ntungamo'),
      municipality('Kyenjojo'),
      town('Kamwenge'),
      town('Kazo'),
      town('Kagadi'),
      town('Ibanda'),
      town('Isingiro'),
      town('Kiruhura'),
      town('Mitooma'),
      town('Rubirizi'),
      district('Buhweju'),
      district('Buliisa'),
      district('Bundibugyo'),
      district('Kikuube'),
      district('Kitagwenda'),
      district('Kyegegwa'),
      district('Ntoroko'),
      district('Rukungiri'),
      district('Rwampara'),
      district('Sheema'),
    ],
  },
];

export const REGION_NAMES = UGANDA_REGIONS.map((region) => region.name);

export function placesInRegion(regionName: string): Place[] {
  return UGANDA_REGIONS.find((region) => region.name === regionName)?.places ?? [];
}

/** "Nansana" -> "Nansana (Municipality)" */
export function formatPlace(place: Place): string {
  return `${place.name} (${place.kind})`;
}

/**
 * Ugandan mobile numbers are 10 digits starting 07, written internationally as
 * +2567XXXXXXXX. Accepts the local form, the +256 form, and tolerates spaces.
 */
export function normalizeUgandanPhone(raw: string): string | null {
  const digits = raw.replace(/[\s()-]/g, '').replace(/^\+?256/, '0');

  if (!/^07\d{8}$/.test(digits)) return null;
  return digits;
}

export function isValidUgandanPhone(raw: string): boolean {
  return normalizeUgandanPhone(raw) !== null;
}
