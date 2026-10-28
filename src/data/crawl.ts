// Static crawl data. The live game state (check-ins, results, photos) lives in Supabase.
// Times are local Glasgow time on Saturday 28 November 2026 (GMT, so UTC+0).

export const EVENT = {
  title: '12 Pubs of Christmas',
  edition: '10th anniversary',
  presentedBy: 'DoakDigital',
  city: 'Glasgow',
  startsAt: '2026-11-28T12:30:00Z',
  endsAt: '2026-11-28T21:30:00Z',
} as const

export type CostumeKey =
  | 'ecto' | 'tree' | 'stocking' | 'schememaw' | 'snowman' | 'boy'
  | 'goth' | 'mistletoe' | 'chocorange' | 'pilot' | 'mystery'

export interface Costume {
  key: CostumeKey
  name: string
  year: number | null
  /** Has this costume been confirmed for this year? */
  confirmed: boolean
  note?: string
}

export const COSTUMES: Record<CostumeKey, Costume> = {
  ecto: { key: 'ecto', name: 'Ecto Frecto', year: 2016, confirmed: true },
  tree: { key: 'tree', name: 'Christmas Tree', year: 2017, confirmed: true },
  stocking: { key: 'stocking', name: 'Christmas Stocking', year: 2018, confirmed: true },
  schememaw: { key: 'schememaw', name: 'Scheme Maw', year: 2019, confirmed: true },
  snowman: { key: 'snowman', name: 'Walking in the Air', year: 2021, confirmed: true, note: 'Duo with Gregor' },
  boy: { key: 'boy', name: 'Walking in the Air', year: 2021, confirmed: true, note: 'Duo with Hammy' },
  goth: { key: 'goth', name: '21 Jump Street Goth', year: 2022, confirmed: true },
  mistletoe: { key: 'mistletoe', name: 'Mistletoe and Wine', year: 2023, confirmed: false }, // [TK] confirm Grant
  chocorange: { key: 'chocorange', name: "Terry's Chocolate Orange", year: 2024, confirmed: true },
  pilot: { key: 'pilot', name: 'Flight Club', year: 2025, confirmed: true },
  mystery: { key: 'mystery', name: 'No costume yet', year: null, confirmed: false }, // [TK] Div
}

export type PlayerId = 'KY' | 'RE' | 'ST' | 'DE' | 'HA' | 'GR' | 'EL' | 'GT' | 'CA' | 'HI' | 'DV'

export interface Player {
  id: PlayerId
  name: string
  costume: CostumeKey
}

export const PLAYERS: Player[] = [
  { id: 'KY', name: 'Kyle', costume: 'ecto' },
  { id: 'RE', name: 'Reece', costume: 'tree' },
  { id: 'ST', name: 'Steve', costume: 'stocking' },
  { id: 'DE', name: 'Dean', costume: 'schememaw' },
  { id: 'HA', name: 'Hammy', costume: 'snowman' },
  { id: 'GR', name: 'Gregor', costume: 'boy' },
  { id: 'EL', name: 'Elz', costume: 'goth' },
  { id: 'GT', name: 'Grant', costume: 'mistletoe' },
  { id: 'CA', name: 'Cal', costume: 'chocorange' },
  { id: 'HI', name: 'Hicksy', costume: 'pilot' },
  { id: 'DV', name: 'Div', costume: 'mystery' },
]

/** Handcuff groups for Blackfriars and O'Neills. */
export const PAIRS: PlayerId[][] = [
  ['GR', 'HI', 'DE'],
  ['HA', 'DV'],
  ['EL', 'ST'],
  ['KY', 'RE'],
]

export const BLINDFOLD_RULES = [
  'Flip a coin. One of you wears the blindfold.',
  'Finish your pint, then pass the blindfold on.',
  'The new wearer finishes this drink and the next, then passes it back.',
  'You buy your drinks together.',
  "No breaking your cuffs, or anyone else's.",
]

export interface Pub {
  n: number
  name: string
  /** Local time, 24h "HH:MM" */
  arrive: string
  leave: string
  stay: string
  challenge: string
  forfeit?: string
  note?: string
  /** Position on the 390px-wide pixel map */
  map: [number, number]
  /** Real-world location for geofenced check-in. [TK] confirm every pin before game day. */
  lat: number | null
  lng: number | null
  /** Check-in radius in metres */
  radius: number
  demolished?: boolean
}

const R = 50

export const PUBS: Pub[] = [
  { n: 1, name: 'Old College Bar', arrive: '12:30', leave: '12:40', stay: '10 mins', challenge: 'Last to down a can of beer loses', map: [56, 66], lat: null, lng: null, radius: R, demolished: true, note: 'Knocked down. Still counts.' },
  { n: 2, name: 'Press Bar', arrive: '12:45', leave: '13:30', stay: '45 mins', challenge: 'Worst dressed / best dressed', map: [196, 60], lat: null, lng: null, radius: R },
  { n: 3, name: 'Blackfriars', arrive: '13:40', leave: '14:15', stay: '35 mins', challenge: "Handcuffs and blindfolds. Don't break the cuffs: yours or anyone else's.", forfeit: 'One of you wears the hat, one takes their shoes off. Can\'t decide? Flip a coin.', map: [334, 72], lat: null, lng: null, radius: R },
  { n: 4, name: "O'Neills", arrive: '14:20', leave: '14:55', stay: '35 mins', challenge: "Handcuffs and blindfolds, same as Blackfriars. Don't break the cuffs.", forfeit: 'One of you wears the hat, one takes their shoes off. Can\'t decide? Flip a coin.', map: [330, 200], lat: null, lng: null, radius: R },
  { n: 5, name: 'Vodka Wodka', arrive: '15:00', leave: '15:15', stay: '15 mins', challenge: 'Short stop', note: 'Send a convoy', map: [192, 190], lat: null, lng: null, radius: R },
  { n: 6, name: 'Amsterdam', arrive: '15:30', leave: '16:15', stay: '45 mins', challenge: 'Imposters / Chameleon', map: [58, 200], lat: null, lng: null, radius: R },
  { n: 7, name: 'The Ark', arrive: '16:30', leave: '17:00', stay: '30 mins', challenge: 'Sing song', map: [60, 330], lat: null, lng: null, radius: R },
  { n: 8, name: "Max's", arrive: '17:10', leave: '17:40', stay: '30 mins', challenge: 'No talking', map: [198, 322], lat: null, lng: null, radius: R },
  { n: 9, name: 'The Lab', arrive: '17:45', leave: '18:00', stay: '15 mins', challenge: 'Shot tray relay race', note: 'Send a convoy', map: [334, 334], lat: null, lng: null, radius: R },
  { n: 10, name: 'The Raven', arrive: '18:20', leave: '18:35', stay: '15 mins', challenge: 'No rule. Quick stop.', map: [330, 462], lat: null, lng: null, radius: R },
  { n: 11, name: 'Felsons', arrive: '18:40', leave: '19:40', stay: '1 hr', challenge: 'Killer', map: [194, 454], lat: null, lng: null, radius: R },
  { n: 12, name: 'Supercube', arrive: '19:30', leave: '21:30', stay: 'Until 9.30pm', challenge: 'Final stop: Supercube, 7.30pm to 9.30pm', note: '£136 paid by Hammy', map: [60, 464], lat: null, lng: null, radius: R },
]

export const SCORING = {
  reachPub: 10,
  challengePassed: 15,
  challengeFailed: -5,
  sleepyJail: -10,
  photo: 2,
} as const

export const sprite = {
  avatar: (id: PlayerId) => `/sprites/avatars/${id.toLowerCase()}.svg`,
  costume: (key: CostumeKey) => `/sprites/costumes/${key}.svg`,
  pub: (n: number) => `/sprites/pubs/${String(n).padStart(2, '0')}.svg`,
}
