const UNIVERSE_KEYWORDS: Record<string, string[]> = {
  Marvel: ['marvel', 'avengers', 'spider-man', 'mcu', 'x-men', 'deadpool', 'loki', 'thor'],
  'Star Wars': ['star wars', 'mandalorian', 'jedi', 'sith', 'lightsaber', 'ahsoka'],
  'DC Universe': ['dc', 'batman', 'superman', 'justice league', 'gotham', 'flash', 'aquaman'],
  'Wizarding World': ['harry potter', 'hogwarts', 'fantastic beasts', 'wizarding world'],
  'Middle Earth': ['lord of the rings', 'tolkien', 'hobbit', 'rings of power'],
  Naruto: ['naruto', 'boruto', 'sasuke', 'hokage', 'shinobi'],
  'One Piece': ['one piece', 'luffy', 'straw hat', 'pirate king'],
  'Dragon Ball': ['dragon ball', 'goku', 'vegeta', 'saiyan', 'dbz'],
  'Studio Ghibli': ['ghibli', 'miyazaki', 'totoro', 'spirited away'],
  'Game of Thrones': ['game of thrones', 'house of the dragon', 'westeros'],
  Disney: ['disney', 'pixar', 'frozen', 'moana'],
  'Stranger Things': ['stranger things', 'upside down', 'hawkins'],
  'The Witcher': ['witcher', 'geralt', 'yennefer'],
  'Video Games': ['playstation', 'xbox', 'nintendo', 'zelda', 'final fantasy', 'elden ring'],
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesKeyword(haystack: string, keyword: string): boolean {
  const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(keyword)}(?:[^a-z0-9]|$)`, 'i');
  return pattern.test(haystack);
}

export function categorize(title: string, content: string): string[] {
  const haystack = `${title || ''} ${content || ''}`.toLowerCase();
  const matches: string[] = [];
  for (const [universe, keywords] of Object.entries(UNIVERSE_KEYWORDS)) {
    if (keywords.some((keyword) => matchesKeyword(haystack, keyword))) {
      matches.push(universe);
    }
  }
  return matches;
}

export { UNIVERSE_KEYWORDS };
