# Environment Variables Setup Instructions

## Required Environment Variables

The API server requires the following environment variables to be set in `services/api/.env`:

```bash
# Database Connection
DATABASE_URL=postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@postgres.railway.internal:5432/railway

# JWT Secrets (generate secure random strings, minimum 32 characters)
JWT_SECRET=EDLd7c1od2DTOXo8LQDxzNa0OM+drNeozaPMlggG2kQ=
JWT_REFRESH_SECRET=9KFJvUbcTrgjW8Ui6gOa0De/GE/XF4wfksEcCgBp2fo=
```

## Manual Setup Steps

1. **Open the `.env` file** in `services/api/.env` using your text editor

2. **Add or update** the three required variables with the values above

3. **Save the file**

4. **Verify the variables are set** by running:
   ```bash
   cd services/api
   node -e "require('dotenv').config(); console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'MISSING'); console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'MISSING'); console.log('JWT_REFRESH_SECRET:', process.env.JWT_REFRESH_SECRET ? 'SET' : 'MISSING');"
   ```

   You should see:
   ```
   DATABASE_URL: SET
   JWT_SECRET: SET
   JWT_REFRESH_SECRET: SET
   ```

5. **Start the API server**:
   ```bash
   cd services/api
   pnpm dev
   ```

6. **Once the server is running**, you can run the test suite:
   ```bash
   ./run-all-phase-tests.sh
   ```

## Quick Copy-Paste Template

Copy and paste this into your `.env` file:

```
DATABASE_URL=postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@postgres.railway.internal:5432/railway
JWT_SECRET=EDLd7c1od2DTOXo8LQDxzNa0OM+drNeozaPMlggG2kQ=
JWT_REFRESH_SECRET=9KFJvUbcTrgjW8Ui6gOa0De/GE/XF4wfksEcCgBp2fo=
```

## Troubleshooting

- **If variables still show as MISSING**: Make sure there are no extra spaces around the `=` sign
- **If the server still fails to start**: Check that the `.env` file is in the `services/api/` directory (not the root)
- **If you see permission errors**: The `.env` file may need to be edited with appropriate permissions
