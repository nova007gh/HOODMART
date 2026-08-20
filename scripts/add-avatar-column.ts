/**
 * Add avatar column to employees table in Supabase.
 *
 * Usage:
 *   npx tsx scripts/add-avatar-column.ts
 *
 * This connects directly to the Supabase Postgres database using the
 * connection string. You'll need to provide the database password.
 *
 * Alternatively, you can run this SQL in the Supabase SQL Editor:
 *   ALTER TABLE employees ADD COLUMN IF NOT EXISTS avatar TEXT;
 */

import { Client } from 'pg'
import * as dotenv from 'dotenv'
import * as readline from 'readline'

dotenv.config({ path: './.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ref = SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1]

if (!ref) {
  console.error('Could not extract project ref from NEXT_PUBLIC_SUPABASE_URL')
  process.exit(1)
}

async function main() {
  // Check if DATABASE_URL is already set
  let connStr = process.env.DATABASE_URL || process.env.POSTGRES_URL

  if (!connStr) {
    // Ask user for password
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    const password = await new Promise<string>((resolve) => {
      rl.question('Enter your Supabase database password: ', (answer) => {
        rl.close()
        resolve(answer.trim())
      })
    })

    if (!password) {
      console.error('Password is required')
      process.exit(1)
    }

    connStr = `postgresql://postgres:${password}@db.${ref}.supabase.co:5432/postgres`
  }

  console.log(`Connecting to Supabase project: ${ref}`)
  console.log('Running migration: ALTER TABLE employees ADD COLUMN IF NOT EXISTS avatar TEXT')

  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } })

  try {
    await client.connect()
    console.log('Connected to database')

    const result = await client.query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS avatar TEXT')
    console.log('Migration successful!', result.command, '— avatar column added to employees table')

    // Verify
    const check = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'avatar'")
    if (check.rows.length > 0) {
      console.log('Verified: avatar column exists in employees table')
    } else {
      console.log('Warning: avatar column was not found after migration')
    }
  } catch (err: any) {
    console.error('Migration failed:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
