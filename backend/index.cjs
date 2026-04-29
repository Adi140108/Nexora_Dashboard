const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = process.env.PORT || 5000;

// Allow requests from Vercel frontend (and localhost for dev)
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
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

// Database setup
const isRender = process.env.RENDER === 'true';
const dbPath = isRender
  ? '/data/registrations.db'
  : path.resolve(__dirname, 'registrations.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Database connection error:', err);
  else console.log(`Connected to SQLite database at ${dbPath}`);
});

// Initialize tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE,
    status TEXT,
    payment_status TEXT,
    payment_time TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT,
    name TEXT,
    email TEXT,
    phone TEXT,
    college TEXT,
    is_captain INTEGER,
    FOREIGN KEY(team_id) REFERENCES teams(id)
  )`);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Endpoints
app.get('/api/check-name', (req, res) => {
  const { name } = req.query;
  db.get('SELECT name FROM teams WHERE LOWER(name) = LOWER(?)', [name], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ available: !row });
  });
});

app.get('/api/registrations', (req, res) => {
  const query = `
    SELECT t.*, m.name as member_name, m.email, m.phone, m.college, m.is_captain
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
          email: row.email,
          phone: row.phone,
          college: row.college,
          isCaptain: row.is_captain === 1
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
    const stmt = db.prepare('INSERT INTO teams (id, name, status, payment_status, payment_time) VALUES (?, ?, ?, ?, ?)');
    stmt.run(teamId, teamName, status, paymentStatus, paymentTimestamp, function(err) {
      if (err) {
        return res.status(400).json({ error: 'Team name already exists or database error.' });
      }

      const memberStmt = db.prepare('INSERT INTO members (team_id, name, email, phone, college, is_captain) VALUES (?, ?, ?, ?, ?, ?)');
      members.forEach(m => {
        memberStmt.run(teamId, m.name, m.email, m.phone, m.college, m.isCaptain ? 1 : 0);
      });
      memberStmt.finalize();

      res.json({ success: true, teamId });
    });
    stmt.finalize();
  });
});

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
});
