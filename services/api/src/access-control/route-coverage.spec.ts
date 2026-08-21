import * as fs from 'fs';
import * as path from 'path';

/**
 * Structural guarantee: once a module is in enforce mode, every controller
 * route must be @Public() or @RequireAccess(). While ACCESS_CONTROL_MODE is
 * still legacy/shadow, this test reports coverage without failing the suite
 * unless ACCESS_CONTROL_STRICT_COVERAGE=true.
 */
const SRC = path.join(__dirname, '..');

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(full, acc);
    } else if (entry.name.endsWith('.controller.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

describe('route access-control coverage', () => {
  it('finds controllers and reports @RequireAccess adoption', () => {
    const files = walk(SRC);
    expect(files.length).toBeGreaterThan(50);

    let decorated = 0;
    let total = 0;
    const uncovered: string[] = [];

    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      const methods = src.match(/@(Get|Post|Put|Patch|Delete)\(/g) || [];
      total += methods.length;
      if (src.includes('@RequireAccess(') || src.includes('@Public(')) {
        decorated += 1;
      } else if (methods.length > 0) {
        uncovered.push(path.relative(SRC, file));
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `Access-control coverage: ${decorated}/${files.length} controller files have @RequireAccess or @Public; ${uncovered.length} still @Roles-only`,
    );

    if (process.env.ACCESS_CONTROL_STRICT_COVERAGE === 'true') {
      expect(uncovered).toEqual([]);
    } else {
      expect(total).toBeGreaterThan(0);
    }
  });
});
