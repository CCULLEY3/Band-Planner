// src/config/seed.js
// =============================================================================
//  Band Planner — Sample Seed Data
//
//  Creates a complete, realistic test environment:
//    • 3 users   — alex (band_admin), jamie (musician), sam (musician)
//    • 1 band    — The Static Wolves
//    • 4 venues  — Austin, Seattle, San Francisco, Denver
//    • 2 tours   — West Coast Run 2026, Mountain States 2026
//    • 8 gigs    — mix of past (completed), upcoming (confirmed), and inquiry
//    • RSVPs, comments, reactions, activity feed entries
//    • Financial records (payments + expenses)
//
//  Passwords: all accounts use "Password123!"
//  Usage: npm run seed:all  (runs this file then analyticsSeed.js)
// =============================================================================

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : { host: process.env.DB_HOST || 'localhost', port: +process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'band_planner',
        user: process.env.DB_USER || 'postgres', password: process.env.DB_PASSWORD || '' }
);

async function seed() {
  const client = await pool.connect();
  console.log('\n🌱  Seeding Band Planner…\n');

  try {
    await client.query('BEGIN');

    // ── Users ──────────────────────────────────────────────────────────────
    console.log('  👤  Creating users…');
    const hash = await bcrypt.hash('Password123!', 12);

    const userRes = await client.query(`
      INSERT INTO users (name, email, password_hash, role, bio, avatar_color)
      VALUES
        ('Alex Rivera',  'alex@example.com',  $1, 'band_admin', 'Guitarist & founder of The Static Wolves', '#f0522a'),
        ('Jamie Lee',    'jamie@example.com', $1, 'musician',   'Bassist. 10 years on the road.',           '#4a8cff'),
        ('Sam Torres',   'sam@example.com',   $1, 'musician',   'Drummer. Loves long drives and black coffee.','#29cc6a')
      ON CONFLICT DO NOTHING
      RETURNING id, email, name
    `, [hash]);

    if (!userRes.rows.length) {
      console.log('  ℹ️   Seed data already present — skipping (re-run after clearing tables).');
      await client.query('ROLLBACK');
      return;
    }

    const byEmail = Object.fromEntries(userRes.rows.map(u => [u.email, u]));
    const alex  = byEmail['alex@example.com'];
    const jamie = byEmail['jamie@example.com'];
    const sam   = byEmail['sam@example.com'];

    // ── Band ───────────────────────────────────────────────────────────────
    console.log('  🎸  Creating band: The Static Wolves…');
    const { rows: [band] } = await client.query(`
      INSERT INTO bands (name, genre, bio, owner_id)
      VALUES ('The Static Wolves', 'Indie Rock',
        'Three-piece indie rock band from Austin, TX. Known for driving guitar lines and relentless touring.',
        $1)
      RETURNING id
    `, [alex.id]);

    // Band members with RBAC roles
    await client.query(`
      INSERT INTO band_members (band_id, user_id, role) VALUES
        ($1, $2, 'band_leader'),
        ($1, $3, 'band_member'),
        ($1, $4, 'band_member')
    `, [band.id, alex.id, jamie.id, sam.id]);

    // ── Venues ─────────────────────────────────────────────────────────────
    console.log('  🏛   Creating venues…');
    const { rows: venueRows } = await client.query(`
      INSERT INTO venues (name, address, city, state, country, lat, lng, capacity, contact_name, contact_email, created_by)
      VALUES
        ('The Paramount',    '713 Congress Ave',  'Austin',        'TX', 'US',  30.2672, -97.7431, 2500, 'Dana Sparks',  'dana@paramount.example',  $1),
        ('Neumos',           '925 E Pike St',     'Seattle',       'WA', 'US',  47.6132, -122.3200, 650, 'Chris Vega',   'chris@neumos.example',    $1),
        ('The Fillmore SF',  '1805 Geary Blvd',   'San Francisco', 'CA', 'US',  37.7843, -122.4333, 1150,'Morgan Hill',  'morgan@fillmore.example', $1),
        ('Globe Hall',       '4483 Logan St',     'Denver',        'CO', 'US',  39.7792, -104.9847, 500, 'Taylor Reed',  'taylor@globehall.example',$1)
      RETURNING id, name
    `, [alex.id]);

    const venueByName = Object.fromEntries(venueRows.map(v => [v.name, v]));
    const vAustin  = venueByName['The Paramount'];
    const vSeattle = venueByName['Neumos'];
    const vSF      = venueByName['The Fillmore SF'];
    const vDenver  = venueByName['Globe Hall'];

    // ── Tours ──────────────────────────────────────────────────────────────
    console.log('  🗺   Creating tours…');
    const { rows: [wcTour] } = await client.query(`
      INSERT INTO tours (band_id, name, description, start_date, end_date, status, color, total_miles)
      VALUES ($1, 'West Coast Run 2026',
        'Spring run hitting Austin, Seattle, and San Francisco.',
        '2026-04-10', '2026-04-25', 'planning', '#f0522a', 2184)
      RETURNING id
    `, [band.id]);

    const { rows: [msTour] } = await client.query(`
      INSERT INTO tours (band_id, name, description, start_date, end_date, status, color, total_miles)
      VALUES ($1, 'Mountain States 2026',
        'Summer leg through Denver and surrounding area.',
        '2026-07-10', '2026-07-20', 'planning', '#4a8cff', 891)
      RETURNING id
    `, [band.id]);

    // ── Gigs ───────────────────────────────────────────────────────────────
    console.log('  🎤  Creating gigs…');
    const gigInsert = async (venue, tour, title, date, li, sc, st, et, status, deal, amt, tp, notes, ap, ae) => {
      const r = await client.query(
        `INSERT INTO gigs (band_id,venue_id,tour_id,title,gig_date,load_in_time,soundcheck_time,start_time,end_time,status,deal_type,deal_amount,ticket_price,notes,actual_payment,actual_expenses,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id,title`,
        [band.id,venue,tour,title,date,li,sc,st,et,status,deal,amt,tp,notes,ap,ae,alex.id]
      );
      return r.rows[0];
    };
    const gigRows = await Promise.all([
      gigInsert(vAustin.id, wcTour.id,  'West Coast Kickoff – Austin',    '2026-04-10','17:00','18:30','20:00','23:00','confirmed','flat',              1500, 20,'Load in via side alley.',null,null),
      gigInsert(vSeattle.id,wcTour.id,  'Neumos Night – Seattle',          '2026-04-17','18:00','19:00','21:00','23:30','confirmed','guarantee_vs_door', 800,  15,'Advance sold 120 tickets.',null,null),
      gigInsert(vSF.id,     wcTour.id,  'Fillmore Friday – San Francisco', '2026-04-25','16:00','17:30','20:30','23:00','inquiry',  'percentage',        null, 18,'Still negotiating.',null,null),
      gigInsert(vDenver.id, msTour.id,  'Globe Hall – Denver',             '2026-07-12','17:00','18:00','20:00','23:00','confirmed','flat',              1200, 12,null,null,null),
      gigInsert(vAustin.id, null,       'Album Release – Austin',          '2025-11-15','17:00','18:00','20:00','23:00','completed','flat',              3500, 25,'Sold out 3 weeks in advance.',3500,285),
      gigInsert(vSeattle.id,null,       'NYE at Neumos',                   '2025-12-31','19:00','20:00','22:00','02:00','completed','guarantee_vs_door', 2000, 35,null,2600,410),
      gigInsert(vSF.id,     null,       'Fillmore Summer Show',            '2026-08-20','17:00','18:30','21:00','23:30','confirmed','flat',              2200, 22,null,null,null),
      gigInsert(null,       null,       'Private Corporate Event',         '2026-06-14','17:00',null,   '19:00','22:00','confirmed','flat',              5000,  0,'NDA signed.',null,null),
    ]);


    const gigByTitle = Object.fromEntries(gigRows.map(g => [g.title, g]));
    const kickoff    = gigByTitle['West Coast Kickoff – Austin'];
    const neumos     = gigByTitle['Neumos Night – Seattle'];
    const albumRel   = gigByTitle['Album Release – Austin'];

    // ── Tour stops ─────────────────────────────────────────────────────────
    console.log('  📍  Creating tour stops…');
    const wcStops = [
      [wcTour.id, kickoff.id, 1, null, null],
      [wcTour.id, neumos.id,  2, 2114, 1900],
      [wcTour.id, gigByTitle['Fillmore Friday – San Francisco'].id, 3, 808, 700],
    ];
    for (const [tid, gid, ord, mi, dt] of wcStops) {
      await client.query(`
        INSERT INTO tour_stops (tour_id, gig_id, stop_order, miles_from_prev, drive_time_min)
        VALUES ($1,$2,$3,$4,$5) ON CONFLICT (tour_id, gig_id) DO NOTHING
      `, [tid, gid, ord, mi, dt]);
    }
    await client.query(`
      INSERT INTO tour_stops (tour_id, gig_id, stop_order, miles_from_prev, drive_time_min)
      VALUES ($1,$2,1,NULL,NULL) ON CONFLICT (tour_id, gig_id) DO NOTHING
    `, [msTour.id, gigByTitle['Globe Hall – Denver'].id]);

    // ── RSVPs ──────────────────────────────────────────────────────────────
    console.log('  ✋  Creating RSVPs…');
    const rsvps = [
      [kickoff.id, alex.id,  'yes',   'Guitarist / Vocalist'],
      [kickoff.id, jamie.id, 'yes',   'Bassist'],
      [kickoff.id, sam.id,   'maybe', 'Drummer'],
      [neumos.id,  alex.id,  'yes',   'Guitarist / Vocalist'],
      [neumos.id,  jamie.id, 'yes',   'Bassist'],
      [neumos.id,  sam.id,   'yes',   'Drummer'],
      [albumRel.id,alex.id,  'yes',   'Guitarist / Vocalist'],
      [albumRel.id,jamie.id, 'yes',   'Bassist'],
      [albumRel.id,sam.id,   'yes',   'Drummer'],
    ];
    for (const [gid, uid, rsvp, role] of rsvps) {
      await client.query(`
        INSERT INTO participants (gig_id, user_id, rsvp, role)
        VALUES ($1,$2,$3,$4) ON CONFLICT (gig_id, user_id) DO UPDATE SET rsvp=$3
      `, [gid, uid, rsvp, role]);
    }

    // ── Comments + reactions ───────────────────────────────────────────────
    console.log('  💬  Creating comments…');
    const { rows: [pinned] } = await client.query(`
      INSERT INTO comments (gig_id, user_id, body, is_pinned)
      VALUES ($1, $2, 'Load-in is through the side alley — NOT the main entrance. Rick on sound. Great guy, be nice.', TRUE)
      RETURNING id
    `, [kickoff.id, alex.id]);

    const { rows: [q1] } = await client.query(`
      INSERT INTO comments (gig_id, user_id, body)
      VALUES ($1, $2, 'Guest list limit? I have 3 people coming.')
      RETURNING id
    `, [kickoff.id, sam.id]);

    await client.query(`
      INSERT INTO comments (gig_id, user_id, body, parent_id)
      VALUES ($1, $2, 'Max 6 per band member. Send me names by Wednesday and I''ll add them.', $3)
    `, [kickoff.id, alex.id, q1.id]);

    await client.query(`
      INSERT INTO comments (gig_id, user_id, body)
      VALUES ($1, $2, 'Merch order just came in — 50 tees, 30 hoodies. I''ll bring the cash box.')
    `, [kickoff.id, jamie.id]);

    // Reactions on pinned comment
    for (const [uid, emoji] of [[alex.id,'🔥'], [jamie.id,'👍'], [sam.id,'👍']]) {
      await client.query(`
        INSERT INTO comment_reactions (comment_id, user_id, emoji)
        VALUES ($1,$2,$3) ON CONFLICT DO NOTHING
      `, [pinned.id, uid, emoji]);
    }

    // ── Activity feed ──────────────────────────────────────────────────────
    console.log('  📋  Creating activity feed…');
    const activities = [
      [kickoff.id, alex.id,  'gig_created',    { title: 'West Coast Kickoff – Austin' }],
      [kickoff.id, jamie.id, 'rsvp_updated',   { rsvp: 'yes', name: 'Jamie Lee' }],
      [kickoff.id, sam.id,   'rsvp_updated',   { rsvp: 'maybe', name: 'Sam Torres' }],
      [kickoff.id, alex.id,  'comment_pinned', { preview: 'Load-in is through the side alley…' }],
      [albumRel.id,alex.id,  'gig_created',    { title: 'Album Release – Austin' }],
      [albumRel.id,alex.id,  'status_changed', { from: 'confirmed', to: 'completed' }],
    ];
    for (const [gid, uid, action, meta] of activities) {
      await client.query(`
        INSERT INTO activity_feed (gig_id, user_id, action, meta)
        VALUES ($1,$2,$3,$4)
      `, [gid, uid, action, JSON.stringify(meta)]);
    }

    // ── Financial records ──────────────────────────────────────────────────
    console.log('  💰  Creating financial records…');
    const fin = [
      // Completed gigs
      [albumRel.id, 'payment', 'guarantee',   3500, '2025-11-15', 'Guarantee — sold-out show'],
      [albumRel.id, 'payment', 'merch',        890, '2025-11-15', 'Vinyl + tees — best merch night'],
      [albumRel.id, 'expense', 'travel',       120, '2025-11-15', 'Gas + parking'],
      [albumRel.id, 'expense', 'promo',        165, '2025-11-08', 'Flyers + Facebook boost'],
      [gigByTitle['NYE at Neumos'].id, 'payment', 'guarantee', 2600, '2025-12-31', 'NYE guarantee + door split'],
      [gigByTitle['NYE at Neumos'].id, 'payment', 'merch',      310, '2025-12-31', 'Merch table'],
      [gigByTitle['NYE at Neumos'].id, 'expense', 'travel',     280, '2025-12-30', 'Drive to Seattle + hotel'],
      [gigByTitle['NYE at Neumos'].id, 'expense', 'lodging',    130, '2025-12-31', 'Hotel night'],
      // Band-level (not tied to a specific gig)
      [null, 'expense', 'gear',   420, '2026-01-10', 'New kick pedal + cables'],
      [null, 'expense', 'promo',  250, '2026-02-01', 'Press photos shoot'],
      [null, 'payment', 'sponsorship', 1000, '2026-03-01', 'Gear sponsor deal — Strings & Things'],
    ];
    for (const [gid, type, cat, amt, date, desc] of fin) {
      await client.query(`
        INSERT INTO financial_records (band_id, gig_id, record_type, category, amount, record_date, description, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [band.id, gid, type, cat, amt, date, desc, alex.id]);
    }

    await client.query('COMMIT');

    console.log('\n✅  Seed complete!\n');
    console.log('  ┌─────────────────────────────────────────────────┐');
    console.log('  │  Test accounts (password: Password123!)          │');
    console.log('  │                                                  │');
    console.log('  │  alex@example.com   → Band Leader               │');
    console.log('  │  jamie@example.com  → Band Member               │');
    console.log('  │  sam@example.com    → Band Member               │');
    console.log('  │                                                  │');
    console.log('  │  Band: The Static Wolves                         │');
    console.log('  │  Gigs: 8 | Tours: 2 | Venues: 4                 │');
    console.log('  └─────────────────────────────────────────────────┘\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌  Seed failed:', err.message);
    if (process.env.NODE_ENV !== 'production') console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
