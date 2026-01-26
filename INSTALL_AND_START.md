# Install pnpm and Start Development Server

## Step 1: Install pnpm

Run this command to install pnpm globally:

```bash
npm install -g pnpm
```

If you get permission errors, you can install it without sudo using:

```bash
npm install -g pnpm --prefix ~/.npm-global
```

Then add to your PATH (add this to your `~/.zshrc`):
```bash
export PATH="$HOME/.npm-global/bin:$PATH"
source ~/.zshrc
```

## Step 2: Verify Installation

```bash
pnpm --version
```

You should see a version number like `9.0.0` or similar.

## Step 3: Install Dependencies and Start

Once pnpm is installed, run:

```bash
cd "/Users/sabuj/Desktop/HOS-latest Sabu"
pnpm install
```

Then build workspace packages:

```bash
cd packages/shared-types && pnpm run build && cd ../..
cd packages/theme-system && pnpm run build && cd ../..
cd packages/utils && pnpm run build && cd ../..
cd packages/api-client && pnpm run build && cd ../..
```

Then start the server:

```bash
cd apps/web
pnpm run dev
```

## Alternative: Use npx (No Global Install)

If you can't install pnpm globally, use npx:

```bash
cd "/Users/sabuj/Desktop/HOS-latest Sabu"
npx pnpm install
cd packages/shared-types && npx pnpm run build && cd ../..
cd packages/theme-system && npx pnpm run build && cd ../..
cd packages/utils && npx pnpm run build && cd ../..
cd packages/api-client && npx pnpm run build && cd ../..
cd apps/web
npx pnpm run dev
```
