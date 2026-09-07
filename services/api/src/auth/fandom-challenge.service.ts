import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

interface FandomQuestion {
  id: string;
  question: string;
  options: string[];
  /** Index of the correct answer in `options`. */
  correctIndex: number;
  fandom: string;
}

export interface FandomChallenge {
  token: string;
  question: string;
  options: string[];
  fandom: string;
  expiresAt: string;
}

const CHALLENGE_TTL_MS = 120_000; // 2 minutes

const QUESTIONS: FandomQuestion[] = [
  {
    id: 'hp-platform',
    question: 'What platform number does the Hogwarts Express depart from?',
    options: ['Platform 7½', 'Platform 9¾', 'Platform 10', 'Platform 13'],
    correctIndex: 1,
    fandom: 'Harry Potter',
  },
  {
    id: 'hp-owl',
    question: "What is the name of Harry Potter's snowy owl?",
    options: ['Errol', 'Pigwidgeon', 'Hedwig', 'Scabbers'],
    correctIndex: 2,
    fandom: 'Harry Potter',
  },
  {
    id: 'hp-lumos',
    question: 'Which spell produces light from the tip of a wand?',
    options: ['Nox', 'Accio', 'Lumos', 'Expelliarmus'],
    correctIndex: 2,
    fandom: 'Harry Potter',
  },
  {
    id: 'hp-houses',
    question: 'How many houses are there at Hogwarts?',
    options: ['Three', 'Four', 'Five', 'Six'],
    correctIndex: 1,
    fandom: 'Harry Potter',
  },
  {
    id: 'hp-sorting',
    question: 'What magical object sorts students into their Hogwarts house?',
    options: ['The Elder Wand', 'The Mirror of Erised', 'The Sorting Hat', 'The Goblet of Fire'],
    correctIndex: 2,
    fandom: 'Harry Potter',
  },
  {
    id: 'hp-patronus',
    question: "Which spell conjures a Patronus to ward off Dementors?",
    options: ['Expecto Patronum', 'Riddikulus', 'Stupefy', 'Protego'],
    correctIndex: 0,
    fandom: 'Harry Potter',
  },
  {
    id: 'hp-sport',
    question: 'What is the name of the wizarding sport played on broomsticks?',
    options: ['Gobstones', 'Quidditch', 'Wizard Chess', 'Exploding Snap'],
    correctIndex: 1,
    fandom: 'Harry Potter',
  },
  {
    id: 'hp-school-head',
    question: 'Who is the headmaster of Hogwarts when Harry first arrives?',
    options: ['Severus Snape', 'Minerva McGonagall', 'Albus Dumbledore', 'Tom Riddle'],
    correctIndex: 2,
    fandom: 'Harry Potter',
  },
  {
    id: 'lotr-ring',
    question: 'In The Lord of the Rings, who carries the One Ring to Mount Doom?',
    options: ['Gandalf', 'Aragorn', 'Frodo Baggins', 'Legolas'],
    correctIndex: 2,
    fandom: 'Lord of the Rings',
  },
  {
    id: 'lotr-wizard',
    question: "What colour is Gandalf's hat and robes when he first appears?",
    options: ['White', 'Grey', 'Blue', 'Brown'],
    correctIndex: 1,
    fandom: 'Lord of the Rings',
  },
  {
    id: 'lotr-home',
    question: 'What is the name of the peaceful land where Hobbits live?',
    options: ['Rivendell', 'Rohan', 'The Shire', 'Gondor'],
    correctIndex: 2,
    fandom: 'Lord of the Rings',
  },
  {
    id: 'lotr-precious',
    question: 'Which creature calls the One Ring "my precious"?',
    options: ['Sauron', 'Saruman', 'Gollum', 'Bilbo'],
    correctIndex: 2,
    fandom: 'Lord of the Rings',
  },
  {
    id: 'sw-force',
    question: 'What is the mystical energy field that gives Jedi their power?',
    options: ['The Spark', 'The Force', 'The Aether', 'The Matrix'],
    correctIndex: 1,
    fandom: 'Star Wars',
  },
  {
    id: 'sw-lightsaber',
    question: "What colour is a Sith Lord's lightsaber typically?",
    options: ['Green', 'Blue', 'Red', 'Purple'],
    correctIndex: 2,
    fandom: 'Star Wars',
  },
  {
    id: 'sw-yoda',
    question: 'Which Jedi Master is known for speaking in an unusual word order?',
    options: ['Obi-Wan Kenobi', 'Mace Windu', 'Yoda', 'Qui-Gon Jinn'],
    correctIndex: 2,
    fandom: 'Star Wars',
  },
  {
    id: 'marvel-mjolnir',
    question: "What is the name of Thor's hammer?",
    options: ['Stormbreaker', 'Gungnir', 'Mjolnir', 'Jarnbjorn'],
    correctIndex: 2,
    fandom: 'Marvel',
  },
  {
    id: 'marvel-spider',
    question: 'How did Peter Parker gain his spider powers?',
    options: ['A magic spell', 'A radioactive spider bite', 'A super-soldier serum', 'An alien symbiote'],
    correctIndex: 1,
    fandom: 'Marvel',
  },
  {
    id: 'dc-krypton',
    question: "What is the name of Superman's home planet?",
    options: ['Krypton', 'Asgard', 'Xandar', 'Tamaran'],
    correctIndex: 0,
    fandom: 'DC',
  },
  {
    id: 'disney-frozen',
    question: 'In Frozen, what power does Queen Elsa possess?',
    options: ['Fire', 'Ice and snow', 'Wind', 'Shape-shifting'],
    correctIndex: 1,
    fandom: 'Disney',
  },
  {
    id: 'got-motto',
    question: 'Which noble family\'s motto is "Winter Is Coming"?',
    options: ['Lannister', 'Targaryen', 'Stark', 'Baratheon'],
    correctIndex: 2,
    fandom: 'Game of Thrones',
  },
  {
    id: 'got-dragons',
    question: 'Who is known as the Mother of Dragons?',
    options: ['Cersei Lannister', 'Sansa Stark', 'Daenerys Targaryen', 'Arya Stark'],
    correctIndex: 2,
    fandom: 'Game of Thrones',
  },
  {
    id: 'hp-deathly',
    question: 'How many Deathly Hallows are there?',
    options: ['Two', 'Three', 'Four', 'Seven'],
    correctIndex: 1,
    fandom: 'Harry Potter',
  },
  {
    id: 'hp-weasley',
    question: "What is the surname of Harry Potter's best friend Ron?",
    options: ['Granger', 'Longbottom', 'Malfoy', 'Weasley'],
    correctIndex: 3,
    fandom: 'Harry Potter',
  },
  {
    id: 'hp-voldemort',
    question: "What is the real name of 'He Who Must Not Be Named'?",
    options: ['Sirius Black', 'Tom Riddle', 'Lucius Malfoy', 'Barty Crouch'],
    correctIndex: 1,
    fandom: 'Harry Potter',
  },
];

@Injectable()
export class FandomChallengeService {
  private readonly logger = new Logger(FandomChallengeService.name);
  private readonly secret: string;
  private readonly usedTokens = new Set<string>();

  constructor(private config: ConfigService) {
    this.secret = config.get<string>('FANDOM_CHALLENGE_SECRET')
      || config.get<string>('JWT_SECRET')
      || 'fandom-challenge-fallback-key';
  }

  generate(): FandomChallenge {
    const q = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
    const shuffledOptions = this.shuffleWithMapping(q.options, q.correctIndex);
    const nonce = randomBytes(12).toString('hex');
    const expiresAt = Date.now() + CHALLENGE_TTL_MS;

    const payload = `${q.id}|${shuffledOptions.correctShuffledIndex}|${nonce}|${expiresAt}`;
    const sig = this.sign(payload);
    const token = Buffer.from(`${payload}|${sig}`).toString('base64url');

    return {
      token,
      question: q.question,
      options: shuffledOptions.options,
      fandom: q.fandom,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  validate(token: string, answerIndex: number): void {
    if (!token || answerIndex == null || answerIndex < 0 || answerIndex > 3) {
      throw new BadRequestException('Fandom challenge answer is required');
    }

    let decoded: string;
    try {
      decoded = Buffer.from(token, 'base64url').toString('utf8');
    } catch {
      throw new BadRequestException('Invalid fandom challenge token');
    }

    const parts = decoded.split('|');
    if (parts.length !== 5) {
      throw new BadRequestException('Invalid fandom challenge token');
    }
    const [questionId, correctIdxStr, nonce, expiresAtStr, sig] = parts;

    const payload = `${questionId}|${correctIdxStr}|${nonce}|${expiresAtStr}`;
    const expectedSig = this.sign(payload);
    if (!this.timingSafeCompare(sig, expectedSig)) {
      throw new BadRequestException('Fandom challenge token has been tampered with');
    }

    const expiresAt = Number(expiresAtStr);
    if (Date.now() > expiresAt) {
      throw new BadRequestException('Fandom challenge has expired — please request a new one');
    }

    const tokenKey = `${nonce}:${expiresAtStr}`;
    if (this.usedTokens.has(tokenKey)) {
      throw new BadRequestException('This fandom challenge has already been used');
    }

    const correctIdx = Number(correctIdxStr);
    if (answerIndex !== correctIdx) {
      throw new BadRequestException(
        "That's not quite right! True fans know this one — please try again",
      );
    }

    this.usedTokens.add(tokenKey);
    this.pruneExpired();
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('hex');
  }

  private timingSafeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  private shuffleWithMapping(
    options: string[],
    correctIndex: number,
  ): { options: string[]; correctShuffledIndex: number } {
    const indexed = options.map((o, i) => ({ o, isCorrect: i === correctIndex }));
    for (let i = indexed.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
    }
    return {
      options: indexed.map((x) => x.o),
      correctShuffledIndex: indexed.findIndex((x) => x.isCorrect),
    };
  }

  /** Purge tokens whose expiry is in the past (prevent memory leak). */
  private pruneExpired(): void {
    if (this.usedTokens.size < 500) return;
    const now = Date.now();
    for (const key of this.usedTokens) {
      const expiry = Number(key.split(':')[1]);
      if (expiry < now) this.usedTokens.delete(key);
    }
  }
}
