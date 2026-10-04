// Where sellers can deliver: countries (ISO 3166 codes, named in the reader's language by the browser)
// and Indonesia's 38 provinces. Used by the seller page, the public pages and the server (to check what's sent).

// Every country and territory people live in. Names come from Intl.DisplayNames, so they follow the page language.
export const COUNTRIES = ("AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ " +
  "NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ " +
  "UA UG US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW").split(" ");

// Indonesia's provinces, by their official names (the same in every language).
export const PROVINCES = [
  "Aceh", "Bali", "Banten", "Bengkulu", "DI Yogyakarta", "DKI Jakarta", "Gorontalo", "Jambi", "Jawa Barat", "Jawa Tengah",
  "Jawa Timur", "Kalimantan Barat", "Kalimantan Selatan", "Kalimantan Tengah", "Kalimantan Timur", "Kalimantan Utara",
  "Kepulauan Bangka Belitung", "Kepulauan Riau", "Lampung", "Maluku", "Maluku Utara", "Nusa Tenggara Barat", "Nusa Tenggara Timur",
  "Papua", "Papua Barat", "Papua Barat Daya", "Papua Pegunungan", "Papua Selatan", "Papua Tengah", "Riau",
  "Sulawesi Barat", "Sulawesi Selatan", "Sulawesi Tengah", "Sulawesi Tenggara", "Sulawesi Utara",
  "Sumatera Barat", "Sumatera Selatan", "Sumatera Utara",
];

// A country's name in the given locale (e.g. "id-ID"), or its code where the browser can't name it.
const namers = new Map();
export function countryName(code, loc) {
  if (!namers.has(loc)) { try { namers.set(loc, new Intl.DisplayNames([loc], { type: "region" })); } catch { namers.set(loc, null); } }
  try { return namers.get(loc)?.of(code) || code; } catch { return code; }
}
// The countries for a picker: Indonesia first, then the rest in alphabetical order of their names.
export function sortedCountries(loc) {
  const rest = COUNTRIES.filter((c) => c !== "ID").map((code) => ({ code, name: countryName(code, loc) }));
  rest.sort((a, b) => a.name.localeCompare(b.name, loc));
  return [{ code: "ID", name: countryName("ID", loc) }, ...rest];
}
