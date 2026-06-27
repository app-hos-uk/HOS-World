# 📦 Installation Instructions

## Option 1: Install pnpm (Recommended)

### Using npm (requires sudo/admin)
```bash
sudo npm install -g pnpm
```

### Using Homebrew (macOS)
```bash
brew install pnpm
```

### Using Corepack (Node.js 16.13+)
```bash
corepack enable
corepack prepare pnpm@latest --activate
```

### Using standalone script
```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

After installation, restart your terminal or run:
```bash
source ~/.zshrc
```

Then verify:
```bash
pnpm --version
```

---

## Option 2: Use npm instead (Alternative)

If you prefer to use npm instead of pnpm, you can install dependencies with:

```bash
cd services/api
npm install
```

**Note:** The project is configured for pnpm workspaces, but npm should work for installing dependencies in the API service.

---

## After Installation

Once pnpm (or npm) is installed, run:

```bash
cd services/api
pnpm install
# or
npm install
```

This will install all the new dependencies we added:
- `@nestjs/swagger` - API documentation
- `helmet` - Security headers
- `compression` - Response compression
- `@types/compression` - TypeScript types

---

## Verify Installation

After installation, you can verify the packages are installed:

```bash
cd services/api
pnpm list @nestjs/swagger helmet compression
# or
npm list @nestjs/swagger helmet compression
```

---

## Next Steps

1. Install pnpm (choose one method above)
2. Run `pnpm install` in `services/api`
3. Build the project: `pnpm build`
4. Deploy to Railway

---

## Troubleshooting

### If pnpm installation fails:
- Try using `sudo` for npm global install
- Or use Homebrew: `brew install pnpm`
- Or use npm instead: `npm install` in services/api

### If you get permission errors:
- Use `sudo` for global installations
- Or install pnpm using Homebrew (doesn't require sudo)
- Or use npm which is already installed
