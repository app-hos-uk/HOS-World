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
  { n: 'Marvel', logo: '/landing/fandom/marvel-tile.svg', tag: 'Superhero Universe', d: 'Avengers. X-Men. Spider-Man. The entire Marvel Cinematic Universe.', cols: ['#0D0005', '#250008', '#440012', '#680018', '#880A0A'], ac: '#FF3822' },
  { n: 'Star Wars', logo: '/landing/fandom/starwars.svg', tag: 'Galaxy Far Away', d: 'The Force. The Rebellion. Legends written across the stars.', cols: ['#040410', '#0C0C1E', '#181428', '#261E10', '#342808'], ac: '#FFE81F' },
  { n: 'DC Universe', logo: '/landing/fandom/dc.svg', tag: 'The DC Multiverse', d: 'Gotham. Metropolis. The Justice League assembles.', cols: ['#030310', '#07071E', '#0B0F30', '#0F1B4C', '#122464'], ac: '#4DAAFF' },
  { n: 'Middle Earth', logo: '/landing/fandom/lotr.svg', tag: "Tolkien's World", d: 'Hobbits. Elves. Dragons. One ring to rule them all.', cols: ['#040804', '#0A1206', '#121C08', '#1E2A08', '#2A3610'], ac: '#9CB850' },
  { n: 'Wizarding World', logo: '/landing/fandom/wizarding.svg', tag: 'The Magical Realm', d: 'Wizards. Creatures. The enchanted world between worlds.', cols: ['#060610', '#0C0B22', '#121033', '#1C1444', '#281A54'], ac: '#9C55DD' },
  { n: 'Game of Thrones', logo: '/landing/fandom/got.svg', tag: 'Westeros & Beyond', d: 'Iron Throne. Dragons. Fire and blood.', cols: ['#0C0804', '#1A1008', '#2A1808', '#3C2210', '#4C2C14'], ac: '#CC7733' },
  { n: 'Naruto', logo: '/landing/fandom/naruto-konoha.svg', tag: 'Hidden Leaf', d: 'Shinobi legends, the Will of Fire, and the saga that became a global phenomenon.', cols: ['#0a0604', '#140c08', '#1e140c', '#281a10', '#342010'], ac: '#E85D04' },
  { n: 'Wednesday', logo: '/landing/fandom/wednesday.svg', tag: 'Nevermore Academy', d: 'Mystery. Macabre. The outcast who became an icon.', cols: ['#08080C', '#101018', '#181824', '#202030', '#28283C'], ac: '#9090B0' },
  { n: 'Dragon Ball', logo: '/landing/fandom/dragonball.svg', tag: 'Saiyan Saga', d: 'Goku. Vegeta. Legendary warriors and seven mystic spheres.', cols: ['#0A0804', '#14100A', '#1E1810', '#282016', '#34281C'], ac: '#FF9900' },
  { n: 'Disney', logo: '/landing/fandom/disney.svg', tag: 'The Magical Kingdom', d: 'Once upon a time and forever after.', cols: ['#0C0818', '#150D28', '#1E1138', '#2C1550', '#381968'], ac: '#AA66FF' },
  { n: 'Stranger Things', logo: '/landing/fandom/strangerthings.svg', tag: 'The Upside Down', d: 'Hawkins. The Mind Flayer. Lights in the dark.', cols: ['#060404', '#0E0606', '#180808', '#280A0A', '#380B0B'], ac: '#FF2222' },
  { n: 'The Witcher', logo: '/landing/fandom/witcher.svg', tag: 'The Continent', d: 'Geralt. Silver swords. Monsters in the dark.', cols: ['#060806', '#0C1008', '#12180C', '#181E10', '#1E2614'], ac: '#77CC33' },
  { n: 'Video Games', logo: '/landing/fandom/steam.svg', tag: 'Play & Collect', d: 'From Steam to console — the worlds you play and the gear you collect.', cols: ['#030608', '#0A1018', '#101820', '#182030', '#202838'], ac: '#66C0F4' },
  { n: 'Friends', logo: '/landing/fandom/friends.svg', tag: 'Central Perk', d: "I'll be there for you. The one with all the merchandise.", cols: ['#0A0608', '#140C10', '#1E1218', '#281820', '#321E28'], ac: '#E84855' },
  { n: 'Kung Fu Panda', logo: '/landing/fandom/kungfupanda.svg', tag: 'Valley of Peace', d: 'Skadoosh! The Dragon Warrior and the Furious Five.', cols: ['#080A04', '#10140A', '#181E10', '#202816', '#28321C'], ac: '#66BB33' },
  { n: 'Sci-Fi Classics', logo: '/landing/fandom/startrek.svg', tag: 'Boldly Beyond', d: 'Starships, strange worlds, and the final frontier.', cols: ['#040410', '#080818', '#0C1024', '#10183C', '#142048'], ac: '#D4AF37' },
  { n: 'One Piece', logo: '/landing/fandom/onepiece.svg', tag: 'Grand Line', d: 'Luffy. The Straw Hats. The quest for the ultimate treasure.', cols: ['#0A0404', '#140808', '#1E0C0C', '#281010', '#341414'], ac: '#E6302E' },
  { n: 'Other Universe', logo: '/landing/fandom/other.svg', tag: 'Your Story', d: 'Every world not yet named — bring your legend to the House.', cols: ['#05050D', '#0C0C18', '#12122A', '#18183C', '#20204A'], ac: '#C9A84C' },
];
