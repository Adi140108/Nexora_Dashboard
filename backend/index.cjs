require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { google } = require('googleapis');
const path = require('path');

const app = express();
const port = process.env.PORT || 5000;

// Database setup (PostgreSQL/Neon)
// Database setup (SQLite for Local)
const db = new sqlite3.Database('./registrations.db', (err) => {
  if (err) console.error('Database open error:', err);
  else console.log('Connected to local SQLite database');
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
const initDb = () => {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE,
        status TEXT,
        payment_status TEXT,
        payment_time TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id TEXT,
        name TEXT,
        email TEXT,
        phone TEXT,
        college TEXT,
        is_captain BOOLEAN,
        FOREIGN KEY(team_id) REFERENCES teams(id)
      )
    `);
    console.log('SQLite Tables initialized');
  });
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
app.get('/api/check-name', (req, res) => {
  const { name } = req.query;
  db.get('SELECT name FROM teams WHERE LOWER(name) = LOWER(?)', [name], (err, row) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ available: !row });
  });
});

app.get('/api/registrations', (req, res) => {
  const query = `
    SELECT t.*, m.name as member_name, m.email as m_email, m.phone as m_phone, m.college as m_college, m.is_captain
    FROM teams t
    LEFT JOIN members m ON t.id = m.team_id
    ORDER BY t.created_at DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const teams = rows.reduce((acc, row) => {
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
          email: row.m_email,
          phone: row.m_phone,
          college: row.m_college,
          isCaptain: row.is_captain
        });
      }
      return acc;
    }, {});
    res.json(Object.values(teams));
  });
});

app.post('/api/register', (req, res) => {
  const { teamId, teamName, members, transactionId, paymentTimestamp, status, paymentStatus } = req.body;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    const stmt1 = db.prepare('INSERT INTO teams (id, name, status, payment_status, payment_time) VALUES (?, ?, ?, ?, ?)');
    stmt1.run([teamId, teamName, status, paymentStatus, paymentTimestamp], function(err) {
      if (err) {
        db.run('ROLLBACK');
        return res.status(400).json({ error: 'Team name already exists.' });
      }

      const stmt2 = db.prepare('INSERT INTO members (team_id, name, email, phone, college, is_captain) VALUES (?, ?, ?, ?, ?, ?)');
      for (const m of members) {
        stmt2.run([teamId, m.name, m.email, m.phone, m.college, !!m.isCaptain]);
      }
      stmt2.finalize();
      
      db.run('COMMIT', (err) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ success: true, teamId });
      });
    });
    stmt1.finalize();
  });
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
