/**
 * Seeds sample FandomQuiz rows for major fandoms (by slug).
 * Run: pnpm --filter @hos-marketplace/api db:seed-quiz
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Q = { question: string; options: string[]; correctIndex: number };

function buildQuestions(topic: string, n: number): Q[] {
  const out: Q[] = [];
  for (let i = 1; i <= n; i++) {
    out.push({
      question: `${topic}: Sample question ${i}?`,
      options: ['Answer A', 'Answer B', 'Answer C', 'Answer D'],
      correctIndex: 0,
    });
  }
  return out;
}

async function main() {
  const defs = [
    { slug: 'harry-potter', title: 'The Sorting Hat Challenge', difficulty: 'EASY', points: 25, n: 10 },
    { slug: 'harry-potter', title: 'Advanced Potions Mastery', difficulty: 'HARD', points: 50, n: 10 },
    { slug: 'lord-of-the-rings', title: 'Journey Through Middle-earth', difficulty: 'MEDIUM', points: 35, n: 8 },
    { slug: 'anime', title: 'Ultimate Anime Knowledge', difficulty: 'MEDIUM', points: 35, n: 10 },
    { slug: 'marvel', title: 'Avengers Assemble Quiz', difficulty: 'EASY', points: 25, n: 8 },
    { slug: 'dc', title: 'Gotham City Trivia', difficulty: 'EASY', points: 25, n: 8 },
  ];

  for (const d of defs) {
    const fandom = await prisma.fandom.findUnique({ where: { slug: d.slug } });
    if (!fandom) {
      console.warn(`Skip quiz "${d.title}" — fandom slug not found: ${d.slug}`);
      continue;
    }
    const existing = await prisma.fandomQuiz.findFirst({
      where: { fandomId: fandom.id, title: d.title },
    });
    if (existing) {
      console.log(`Exists: ${d.title}`);
      continue;
    }
    await prisma.fandomQuiz.create({
      data: {
        fandomId: fandom.id,
        title: d.title,
        description: `Enchanted Circle sample quiz for ${fandom.name}.`,
        questions: buildQuestions(d.title, d.n),
        pointsReward: d.points,
        difficulty: d.difficulty,
        isActive: true,
      },
    });
    console.log(`Created: ${d.title}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
