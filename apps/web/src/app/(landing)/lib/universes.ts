export type Universe = {
  n: string;
  logo: string;
  tag: string;
  d: string;
  cols: string[];
  ac: string;
  featured?: boolean;
};

export const UNIVERSES: Universe[] = [
  { n: 'Marvel', logo: '/landing/fandom/marvel-tile.svg', tag: 'Superhero Universe', d: 'Avengers. X-Men. Spider-Man. The entire Marvel Cinematic Universe.', cols: ['#0D0005', '#250008', '#440012', '#680018', '#880A0A'], ac: '#FF3822', featured: true },
  { n: 'Star Wars', logo: '/landing/fandom/starwars.svg', tag: 'Galaxy Far Away', d: 'The Force. The Rebellion. Legends written across the stars.', cols: ['#040410', '#0C0C1E', '#181428', '#261E10', '#342808'], ac: '#FFE81F' },
  { n: 'DC Universe', logo: '/landing/fandom/dc.svg', tag: 'The DC Multiverse', d: 'Gotham. Metropolis. The Justice League assembles.', cols: ['#030310', '#07071E', '#0B0F30', '#0F1B4C', '#122464'], ac: '#4DAAFF' },
  { n: 'Middle Earth', logo: '/landing/fandom/lotr.svg', tag: "Tolkien's World", d: 'Hobbits. Elves. Dragons. One ring to rule them all.', cols: ['#040804', '#0A1206', '#121C08', '#1E2A08', '#2A3610'], ac: '#9CB850' },
  { n: 'Wizarding World', logo: '/landing/fandom/wizarding.svg', tag: 'The Magical Realm', d: 'Wizards. Creatures. The enchanted world between worlds.', cols: ['#060610', '#0C0B22', '#121033', '#1C1444', '#281A54'], ac: '#9C55DD' },
  { n: 'Game of Thrones', logo: '/landing/fandom/got.svg', tag: 'Westeros & Beyond', d: 'Iron Throne. Dragons. Fire and blood.', cols: ['#0C0804', '#1A1008', '#2A1808', '#3C2210', '#4C2C14'], ac: '#CC7733' },
  { n: 'Naruto', logo: '/landing/fandom/naruto-konoha.svg', tag: 'Hidden Leaf', d: 'Shinobi legends, the Will of Fire, and the saga that became a global phenomenon.', cols: ['#0a0604', '#140c08', '#1e140c', '#281a10', '#342010'], ac: '#E85D04' },
  { n: 'Studio Ghibli', logo: '/landing/fandom/ghibli.svg', tag: 'The Spirit World', d: 'Spirited Away. Totoro. Howl. Pure wonder.', cols: ['#040C10', '#081420', '#0C1C16', '#102822', '#142E26'], ac: '#44BB77' },
  { n: 'Avatar', logo: '/landing/fandom/avatar.svg', tag: 'The Four Nations', d: 'Water. Earth. Fire. Air. The Avatar returns.', cols: ['#030810', '#07101E', '#0B1830', '#10204A', '#142858'], ac: '#33AAFF' },
  { n: 'Disney', logo: '/landing/fandom/disney.svg', tag: 'The Magical Kingdom', d: 'Once upon a time and forever after.', cols: ['#0C0818', '#150D28', '#1E1138', '#2C1550', '#381968'], ac: '#AA66FF' },
  { n: 'Stranger Things', logo: '/landing/fandom/strangerthings.svg', tag: 'The Upside Down', d: 'Hawkins. The Mind Flayer. Lights in the dark.', cols: ['#060404', '#0E0606', '#180808', '#280A0A', '#380B0B'], ac: '#FF2222' },
  { n: 'The Witcher', logo: '/landing/fandom/witcher.svg', tag: 'The Continent', d: 'Geralt. Silver swords. Monsters in the dark.', cols: ['#060806', '#0C1008', '#12180C', '#181E10', '#1E2614'], ac: '#77CC33' },
  { n: 'Video Games', logo: '/landing/fandom/steam.svg', tag: 'Play & Collect', d: 'From Steam to console — the worlds you play and the gear you collect.', cols: ['#030608', '#0A1018', '#101820', '#182030', '#202838'], ac: '#66C0F4' },
  { n: 'Transformers', logo: '/landing/fandom/transformers.svg', tag: 'Robots in Disguise', d: 'Autobots. Decepticons. More than meets the eye.', cols: ['#080404', '#140808', '#201010', '#2C1418', '#381820'], ac: '#E31837' },
  { n: 'Twilight', logo: '/landing/fandom/twilight.svg', tag: 'Forever Moonlit', d: 'Forks. Immortal love. The saga that defined a generation.', cols: ['#040608', '#0A1016', '#101826', '#142030', '#18283C'], ac: '#B8C5D6' },
  { n: 'Sci-Fi Classics', logo: '/landing/fandom/startrek.svg', tag: 'Boldly Beyond', d: 'Starships, strange worlds, and the final frontier.', cols: ['#040410', '#080818', '#0C1024', '#10183C', '#142048'], ac: '#D4AF37' },
  { n: 'Fantasy Epics', logo: '/landing/fandom/wizards.svg', tag: 'Dice & Dragons', d: 'Tabletop legends, living campaigns, boundless imagination.', cols: ['#060804', '#0C1008', '#12180C', '#182010', '#1E2814'], ac: '#C9A84C' },
  { n: 'Other Universe', logo: '/landing/fandom/other.svg', tag: 'Your Story', d: 'Every world not yet named — bring your legend to the House.', cols: ['#05050D', '#0C0C18', '#12122A', '#18183C', '#20204A'], ac: '#C9A84C' },
];
