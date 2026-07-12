/**
 * Seeds landing-page universes from the static marketing list.
 * Run: pnpm --filter @hos-marketplace/api db:seed-universes
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const UNIVERSES = [
  { name: 'Marvel', logo: '/landing/fandom/marvel-tile.svg', tag: 'Superhero Universe', description: 'Avengers. X-Men. Spider-Man. The entire Marvel Cinematic Universe.', gradientColors: ['#0D0005', '#250008', '#440012', '#680018', '#880A0A'], accentColor: '#FF3822' },
  { name: 'Star Wars', logo: '/landing/fandom/starwars.svg', tag: 'Galaxy Far Away', description: 'The Force. The Rebellion. Legends written across the stars.', gradientColors: ['#040410', '#0C0C1E', '#181428', '#261E10', '#342808'], accentColor: '#FFE81F' },
  { name: 'DC Universe', logo: '/landing/fandom/dc.svg', tag: 'The DC Multiverse', description: 'Gotham. Metropolis. The Justice League assembles.', gradientColors: ['#030310', '#07071E', '#0B0F30', '#0F1B4C', '#122464'], accentColor: '#4DAAFF' },
  { name: 'Middle Earth', logo: '/landing/fandom/lotr.svg', tag: "Tolkien's World", description: 'Hobbits. Elves. Dragons. One ring to rule them all.', gradientColors: ['#040804', '#0A1206', '#121C08', '#1E2A08', '#2A3610'], accentColor: '#9CB850' },
  { name: 'Wizarding World', logo: '/landing/fandom/wizarding.svg', tag: 'The Magical Realm', description: 'Wizards. Creatures. The enchanted world between worlds.', gradientColors: ['#060610', '#0C0B22', '#121033', '#1C1444', '#281A54'], accentColor: '#9C55DD' },
  { name: 'Game of Thrones', logo: '/landing/fandom/got.svg', tag: 'Westeros & Beyond', description: 'Iron Throne. Dragons. Fire and blood.', gradientColors: ['#0C0804', '#1A1008', '#2A1808', '#3C2210', '#4C2C14'], accentColor: '#CC7733' },
  { name: 'Naruto', logo: '/landing/fandom/naruto-konoha.svg', tag: 'Hidden Leaf', description: 'Shinobi legends, the Will of Fire, and the saga that became a global phenomenon.', gradientColors: ['#0a0604', '#140c08', '#1e140c', '#281a10', '#342010'], accentColor: '#E85D04' },
  { name: 'Wednesday', logo: '/landing/fandom/wednesday.svg', tag: 'Nevermore Academy', description: 'Mystery. Macabre. The outcast who became an icon.', gradientColors: ['#08080C', '#101018', '#181824', '#202030', '#28283C'], accentColor: '#9090B0' },
  { name: 'Dragon Ball', logo: '/landing/fandom/dragonball.svg', tag: 'Saiyan Saga', description: 'Goku. Vegeta. Legendary warriors and seven mystic spheres.', gradientColors: ['#0A0804', '#14100A', '#1E1810', '#282016', '#34281C'], accentColor: '#FF9900' },
  { name: 'Disney', logo: '/landing/fandom/disney.svg', tag: 'The Magical Kingdom', description: 'Once upon a time and forever after.', gradientColors: ['#0C0818', '#150D28', '#1E1138', '#2C1550', '#381968'], accentColor: '#AA66FF' },
  { name: 'Stranger Things', logo: '/landing/fandom/strangerthings.svg', tag: 'The Upside Down', description: 'Hawkins. The Mind Flayer. Lights in the dark.', gradientColors: ['#060404', '#0E0606', '#180808', '#280A0A', '#380B0B'], accentColor: '#FF2222' },
  { name: 'The Witcher', logo: '/landing/fandom/witcher.svg', tag: 'The Continent', description: 'Geralt. Silver swords. Monsters in the dark.', gradientColors: ['#060806', '#0C1008', '#12180C', '#181E10', '#1E2614'], accentColor: '#77CC33' },
  { name: 'Video Games', logo: '/landing/fandom/steam.svg', tag: 'Play & Collect', description: 'From Steam to console — the worlds you play and the gear you collect.', gradientColors: ['#030608', '#0A1018', '#101820', '#182030', '#202838'], accentColor: '#66C0F4' },
  { name: 'Friends', logo: '/landing/fandom/friends.svg', tag: 'Central Perk', description: "I'll be there for you. The one with all the merchandise.", gradientColors: ['#0A0608', '#140C10', '#1E1218', '#281820', '#321E28'], accentColor: '#E84855' },
  { name: 'Kung Fu Panda', logo: '/landing/fandom/kungfupanda.svg', tag: 'Valley of Peace', description: 'Skadoosh! The Dragon Warrior and the Furious Five.', gradientColors: ['#080A04', '#10140A', '#181E10', '#202816', '#28321C'], accentColor: '#66BB33' },
  { name: 'Sci-Fi Classics', logo: '/landing/fandom/startrek.svg', tag: 'Boldly Beyond', description: 'Starships, strange worlds, and the final frontier.', gradientColors: ['#040410', '#080818', '#0C1024', '#10183C', '#142048'], accentColor: '#D4AF37' },
  { name: 'One Piece', logo: '/landing/fandom/onepiece.svg', tag: 'Grand Line', description: 'Luffy. The Straw Hats. The quest for the ultimate treasure.', gradientColors: ['#0A0404', '#140808', '#1E0C0C', '#281010', '#341414'], accentColor: '#E6302E' },
  { name: 'Other Universe', logo: '/landing/fandom/other.svg', tag: 'Your Story', description: 'Every world not yet named — bring your legend to the House.', gradientColors: ['#05050D', '#0C0C18', '#12122A', '#18183C', '#20204A'], accentColor: '#C9A84C' },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  for (let i = 0; i < UNIVERSES.length; i++) {
    const u = UNIVERSES[i];
    const slug = slugify(u.name);
    const existing = await prisma.universe.findUnique({ where: { slug } });
    if (existing) {
      console.log(`Exists: ${u.name}`);
      continue;
    }

    await prisma.universe.create({
      data: {
        name: u.name,
        slug,
        logo: u.logo,
        tag: u.tag,
        description: u.description,
        accentColor: u.accentColor,
        gradientColors: u.gradientColors,
        order: i,
        featured: false,
        isActive: true,
      },
    });
    console.log(`Created: ${u.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
