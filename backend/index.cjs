const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 5000;

// Database setup (PostgreSQL/Neon)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Neon
  }
});

// Allow requests from Vercel frontend
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true
}));

app.use(bodyParser.json());

// Initialize tables
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE,
        status TEXT,
        payment_status TEXT,
        payment_time TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS members (
        id SERIAL PRIMARY KEY,
        team_id TEXT REFERENCES teams(id),
        name TEXT,
        email TEXT,
        phone TEXT,
        college TEXT,
        is_captain BOOLEAN
      )
    `);
    console.log('PostgreSQL Tables initialized');
  } catch (err) {
    console.error('Database init error:', err);
  }
};

initDb();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', database: 'connected' });
});

// API Endpoints
app.get('/api/check-name', async (req, res) => {
  const { name } = req.query;
  try {
    const result = await pool.query('SELECT name FROM teams WHERE LOWER(name) = LOWER($1)', [name]);
    res.json({ available: result.rows.length === 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/registrations', async (req, res) => {
  const query = `
    SELECT t.*, m.name as member_name, m.email, m.phone, m.college, m.is_captain
    FROM teams t
    LEFT JOIN members m ON t.id = m.team_id
    ORDER BY t.created_at DESC
  `;

  try {
    const result = await pool.query(query);
    const teams = result.rows.reduce((acc, row) => {
      if (!acc[row.id]) {
        acc[row.id] = {
          id: row.id,
          teamName: row.name,
          status: row.status,
          paymentStatus: row.payment_status,
          paymentTime: row.payment_time,
          createdAt: row.created_at,
          members: []
        };
      }
      if (row.member_name) {
        acc[row.id].members.push({
          name: row.member_name,
          email: row.email,
          phone: row.phone,
          college: row.college,
          isCaptain: row.is_captain
        });
      }
      return acc;
    }, {});
    res.json(Object.values(teams));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/register', async (req, res) => {
  const { teamId, teamName, members, transactionId, paymentTimestamp, status, paymentStatus } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(
      'INSERT INTO teams (id, name, status, payment_status, payment_time) VALUES ($1, $2, $3, $4, $5)',
      [teamId, teamName, status, paymentStatus, paymentTimestamp]
    );

    for (const m of members) {
      await client.query(
        'INSERT INTO members (team_id, name, email, phone, college, is_captain) VALUES ($1, $2, $3, $4, $5, $6)',
        [teamId, m.name, m.email, m.phone, m.college, !!m.isCaptain]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, teamId });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: 'Team name already exists or database error.' });
  } finally {
    client.release();
  }
});

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
});
