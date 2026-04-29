require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const { google } = require('googleapis');
const path = require('path');

const app = express();
const port = process.env.PORT || 5000;

// Database setup (PostgreSQL/Neon)
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

// Google Sheets Auth Helper
const getGoogleAuth = () => {
  try {
    const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    return new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
  } catch (err) {
    console.error('Google Auth Setup Error:', err);
    return null;
  }
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', database: 'connected' });
});

// Sync from Google Sheets (Authenticated)
app.get('/api/sync-sheets', async (req, res) => {
  const { teamId, paymentId, masterId } = req.query;
  const auth = getGoogleAuth();
  
  if (!auth) {
    return res.status(500).json({ error: 'Google Credentials not configured on server' });
  }

  const sheets = google.sheets({ version: 'v4', auth });
  
  try {
    const fetchSheet = async (spreadsheetId, range = 'A1:Z1000') => {
      if (!spreadsheetId) return [];
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      const rows = response.data.values;
      if (!rows || rows.length === 0) return [];
      
      const headers = rows[0];
      return rows.slice(1).map(row => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || '';
        });
        return obj;
      });
    };

    // Try Sheet7 for teams, fallback to Sheet1
    let teamData = [];
    try {
      teamData = await fetchSheet(teamId, 'Sheet7!A1:Z1000');
    } catch (e) {
      teamData = await fetchSheet(teamId, 'A1:Z1000');
    }

    const paymentData = await fetchSheet(paymentId, 'A1:Z1000');
    const masterData = await fetchSheet(masterId, 'A1:Z1000');

    res.json({ teamData, paymentData, masterData });
  } catch (err) {
    console.error('Google Sheets API Error:', err);
    res.status(500).json({ error: err.message });
  }
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
}).on('error', (err) => {
  console.error('Server error:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
