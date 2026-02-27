// Run migration 006 via Supabase Management API
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

// Extract project ref from URL
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];

async function runMigration() {
    const sql = fs.readFileSync(
        path.resolve(__dirname, 'supabase/migrations/006_payment_orders.sql'),
        'utf-8'
    );

    console.log('Running migration 006 on project:', projectRef);

    const resp = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: sql }),
        }
    );

    const text = await resp.text();
    if (resp.ok) {
        console.log('Migration 006 SUCCESS');
        try { console.log(JSON.parse(text)); } catch { console.log(text); }
    } else {
        console.error('Migration 006 FAILED:', resp.status, text);
    }
}

runMigration().catch(console.error);
