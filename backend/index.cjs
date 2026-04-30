require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const { google } = require('googleapis');
const path = require('path');

const app = express();
const port = process.env.PORT || 5000;

const isRender = process.env.RENDER === 'true';
let db;

if (isRender) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  db = {
    query: (text, params) => pool.query(text, params),
    connect: () => pool.connect()
  };
  console.log('Using PostgreSQL (Render)');
} else {
  const sqlite3 = require('sqlite3').verbose();
  const sqliteDb = new sqlite3.Database(path.join(__dirname, 'registrations.db'));
  
  // Promisify SQLite for compatibility with PG-style async/await
  db = {
    query: (text, params = []) => {
      // Convert $1, $2 style to ? for SQLite
      const sql = text.replace(/\$\d+/g, '?');
      return new Promise((resolve, reject) => {
        if (sql.trim().toLowerCase().startsWith('select')) {
          sqliteDb.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve({ rows });
          });
        } else {
          sqliteDb.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ rows: [], lastID: this.lastID, changes: this.changes });
          });
        }
      });
    },
    connect: () => ({
      query: (text, params) => db.query(text, params),
      release: () => {}
    })
  };
  console.log('Using SQLite (Local)');
}

// Allow requests from Vercel frontend
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.startsWith('http://localhost') || origin.endsWith('.vercel.app')) {
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
    const isPostgres = isRender;
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE,
        status TEXT,
        payment_status TEXT,
        payment_time TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS members (
        id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
        team_id TEXT ${isPostgres ? 'REFERENCES teams(id)' : ''},
        name TEXT,
        email TEXT,
        phone TEXT,
        college TEXT,
        is_captain BOOLEAN
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
        team_name TEXT,
        member_name TEXT,
        marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ${isPostgres ? ', UNIQUE(team_name, member_name)' : ''}
      )
    `);
    
    if (!isPostgres) {
      // SQLite doesn't support ON CONFLICT in CREATE TABLE like PG for named columns easily in some versions
      // but we can add the unique constraint
      try {
        await db.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique ON attendance(team_name, member_name)');
      } catch (e) {}
    }

    console.log(`${isPostgres ? 'PostgreSQL' : 'SQLite'} Tables initialized`);
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
    const result = await db.query('SELECT name FROM teams WHERE LOWER(name) = LOWER($1)', [name]);
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
    const result = await db.query(query);
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

  try {
    // Note: SQLite doesn't support BEGIN/COMMIT as pool.connect() style as easily, 
    // but for this simple insert it's fine without a formal transaction for now.
    
    await db.query(
      'INSERT INTO teams (id, name, status, payment_status, payment_time) VALUES ($1, $2, $3, $4, $5)',
      [teamId, teamName, status, paymentStatus, paymentTimestamp]
    );

    for (const m of members) {
      await db.query(
        'INSERT INTO members (team_id, name, email, phone, college, is_captain) VALUES ($1, $2, $3, $4, $5, $6)',
        [teamId, m.name, m.email, m.phone, m.college, !!m.isCaptain]
      );
    }

    res.json({ success: true, teamId });
  } catch (err) {
    res.status(400).json({ error: 'Team name already exists or database error.' });
  }
});

// Get all attendance
app.get('/api/attendance', async (req, res) => {
  try {
    const result = await db.query('SELECT team_name, member_name FROM attendance');
    const attendance = result.rows.reduce((acc, row) => {
      if (!acc[row.team_name]) acc[row.team_name] = [];
      acc[row.team_name].push(row.member_name);
      return acc;
    }, {});
    res.json(attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle attendance
app.post('/api/attendance', async (req, res) => {
  const { teamName, memberName, isPresent } = req.body;
  try {
    if (isPresent) {
      // Use INSERT OR IGNORE for SQLite, ON CONFLICT DO NOTHING for PG
      const query = isRender 
        ? 'INSERT INTO attendance (team_name, member_name) VALUES ($1, $2) ON CONFLICT DO NOTHING'
        : 'INSERT OR IGNORE INTO attendance (team_name, member_name) VALUES ($1, $2)';
        
      await db.query(query, [teamName, memberName]);
    } else {
      await db.query(
        'DELETE FROM attendance WHERE team_name = $1 AND member_name = $2',
        [teamName, memberName]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
