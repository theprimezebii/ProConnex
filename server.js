// server.js for ProConnex

const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/proconnex.db');

const JWT_SECRET = 'your_secret_key';
app.use(cookieParser());

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ secret: 'proconnex_secret', resave: false, saveUninitialized: true }));

// Create tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      profilePic TEXT DEFAULT 'default-profile.png'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      budget TEXT,
      deadline TEXT,
      category TEXT,
      skills TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      proposal TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(job_id, user_id)
    )
  `);
  db.run(`
  CREATE TABLE IF NOT EXISTS nearnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
  )
`);
db.run(`
  CREATE TABLE IF NOT EXISTS forum_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
)
  `);
  
});

// File upload (profile image)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './public/uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

function verifyToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.redirect('/');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    db.get(`SELECT * FROM users WHERE id = ?`, [decoded.id], (err, user) => {
      if (err || !user) return res.redirect('/');
      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        profilePic: user.profilePic || 'default-profile.png'
      };
      next();
    });
  } catch {
    return res.redirect('/');
  }
}

// Auth Middleware
function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/');
}

// Routes
app.get('/', (req, res) => {
  res.render('home', { user: req.session.user, currentPage: 'home' });
});
app.get('/dashboard', verifyToken, (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) return res.redirect('/signin');

  const user = req.session.user;

  // 1. Total Jobs Posted
  db.get(`SELECT COUNT(*) AS count FROM jobs WHERE user_id = ?`, [userId], (err1, jobRow) => {
    if (err1) {
      console.error("Error fetching jobs:", err1);
      return res.status(500).send("Failed to load jobs.");
    }

    // 2. Active Applications
    db.get(`SELECT COUNT(*) AS count FROM applications WHERE user_id = ? AND status = 'active'`, [userId], (err2, appRow) => {
      if (err2) {
        console.error("Error fetching applications:", err2);
        return res.status(500).send("Failed to load applications.");
      }

      // 3. Total Earnings
      db.get(`SELECT SUM(amount) AS total FROM earnings WHERE user_id = ?`, [userId], (err3, earningsRow) => {
        if (err3) {
          console.error("Error fetching earnings:", err3);
          return res.status(500).send("Failed to load earnings.");
        }

        res.render('dashboard', {
          user,
          totalJobs: jobRow?.count || 0,
          activeApplications: appRow?.count || 0,
          totalEarnings: earningsRow?.total || 0,
          currentPage: 'dashboard'
        });
      });
    });
  });
});

app.post('/upload-profile', verifyToken, upload.single('profilePic'), (req, res) => {
  if (!req.file) return res.redirect('/dashboard');
  const filename = req.file.filename;
  const email = req.session.user.email;

  db.run(`UPDATE users SET profilePic = ? WHERE email = ?`, [filename, email], function (err) {
    if (err) {
      console.error('Error updating profile picture:', err);
      return res.redirect('/dashboard');
    }
    req.session.user.profilePic = filename;
    res.redirect('/dashboard');
  });
});

app.get('/create-job', verifyToken, (req, res) => {
  res.render('create-job', { user: req.session.user, currentPage: 'create-job' });
});

app.post('/create-job', verifyToken, (req, res) => {
  const { title, description, budget, deadline, category, skills } = req.body;
  const userId = req.session.user.id;

  if (!title?.trim() || !description?.trim() || !budget || !deadline || !category?.trim() || !skills?.trim()) {
    return res.status(400).send("All fields are required.");
  }
  if (isNaN(budget) || Number(budget) <= 0) {
    return res.status(400).send("Budget must be a positive number.");
  }
  const deadlineDate = new Date(deadline);
  if (isNaN(deadlineDate.getTime()) || deadlineDate <= new Date()) {
    return res.status(400).send("Deadline must be a valid future date.");
  }

  db.run(
    `INSERT INTO jobs (title, description, budget, deadline, category, skills, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title.trim(), description.trim(), budget, deadline, category.trim(), skills.trim(), userId],
    (err) => {
      if (err) return res.status(500).send("Failed to post job.");
      res.redirect('/dashboard');
    }
  );
});

app.get('/jobs/:id', (req, res) => {
  res.render('job-details', { user: req.session.user, currentPage: 'job-details', jobId: req.params.id });
});



app.get('/training', (req, res) => {
  res.render('training-courses', { user: req.session.user, currentPage: 'training' });
});

app.get('/payments', verifyToken, (req, res) => {
  res.render('payments-earnings', { user: req.session.user, currentPage: 'payments' });
});

app.get('/contact', (req, res) => {
  res.render('contact', { user: req.session.user, currentPage: 'contact' });
});

app.get('/about', (req, res) => {
  res.render('about', { user: req.session.user, currentPage: 'about' });
});

app.get('/my-jobs', verifyToken, (req, res) => {
  const userId = req.session.user.id;
  db.all(`SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC`, [userId], (err, rows) => {
    if (err) return res.render('my-jobs', { user: req.session.user, myJobs: [], currentPage: 'my-jobs' });
    res.render('my-jobs', { user: req.session.user, myJobs: rows, currentPage: 'my-jobs' });
  });
});

app.get('/browse-jobs', (req, res) => {
  const userId = req.session.user?.id || 0;
  db.all('SELECT * FROM jobs WHERE user_id != ? ORDER BY created_at DESC', [userId], (err, jobs) => {
    if (err) return res.status(500).send('Server Error');
    res.render('browse-jobs', { user: req.session.user, jobs, currentPage: 'browse-jobs' });
  });
});

app.get('/apply-job/:id', verifyToken, (req, res) => {
  const jobId = req.params.id;
  db.get('SELECT * FROM jobs WHERE id = ?', [jobId], (err, job) => {
    if (err || !job) return res.status(404).send('Job not found.');
    if (job.user_id === req.session.user.id) return res.status(403).send("You cannot apply to your own job.");
    res.render('apply-job', { user: req.session.user, currentPage: 'apply-job', job });
  });
});

app.post('/apply-job/:id', verifyToken, (req, res) => {
  const jobId = req.params.id;
  const userId = req.session.user.id;
  const proposal = req.body.proposal;

  db.get(`SELECT * FROM applications WHERE job_id = ? AND user_id = ?`, [jobId, userId], (err, existing) => {
    if (existing) return res.status(400).send("Already applied to this job");
    db.run(`INSERT INTO applications (job_id, user_id, proposal) VALUES (?, ?, ?)`, [jobId, userId, proposal], function (err) {
      if (err) return res.status(500).send("Error applying");
      res.redirect('/browse-jobs');
    });
  });
});

app.post('/logout', (req, res) => {
  res.clearCookie('token');
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.post('/signup', async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;
  if (password !== confirmPassword) return res.redirect('/');

  const hashedPassword = await bcrypt.hash(password, 10);
  db.run(`INSERT INTO users (name, email, password) VALUES (?, ?, ?)`, [name, email, hashedPassword], function (err) {
    if (err) return res.redirect('/');
    const token = jwt.sign({ id: this.lastID, name, email }, JWT_SECRET);
    res.cookie('token', token, { httpOnly: true });
    req.session.user = { id: this.lastID, name, email, profilePic: 'default-profile.png' };
    res.redirect('/dashboard');
  });
});

app.post('/signin', (req, res) => {
  const { email, password } = req.body;
  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err || !user) return res.redirect('/');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.redirect('/');
    const token = jwt.sign({ id: user.id, name: user.name, email }, JWT_SECRET);
    res.cookie('token', token, { httpOnly: true });
    req.session.user = { id: user.id, name: user.name, email: user.email, profilePic: user.profilePic || 'default-profile.png' };
    res.redirect('/dashboard');
  });
});

app.post('/delete-job/:id', verifyToken, (req, res) => {
  const jobId = req.params.id;
  const userId = req.session.user.id;
  db.run(`DELETE FROM jobs WHERE id = ? AND user_id = ?`, [jobId, userId], function (err) {
    if (err) return res.status(500).send('Error deleting job.');
    res.redirect('/my-jobs');
  });
});

app.get('/edit-job/:id', verifyToken, (req, res) => {
  const jobId = req.params.id;
  const userId = req.session.user.id;
  db.get(`SELECT * FROM jobs WHERE id = ? AND user_id = ?`, [jobId, userId], (err, job) => {
    if (err || !job) return res.redirect('/my-jobs');
    res.render('edit-job', { user: req.session.user, currentPage: 'edit-job', job });
  });
});

app.post('/edit-job/:id', verifyToken, (req, res) => {
  const jobId = req.params.id;
  const userId = req.session.user.id;
  const { title, description, budget, deadline, category, skills } = req.body;
  db.run(`
    UPDATE jobs 
    SET title = ?, description = ?, budget = ?, deadline = ?, category = ?, skills = ?
    WHERE id = ? AND user_id = ?`,
    [title, description, budget, deadline, category, skills, jobId, userId],
    (err) => {
      if (err) return res.status(500).send('Failed to update job.');
      res.redirect('/my-jobs');
    }
  );
});

app.get('/my-applications', verifyToken, (req, res) => {
  const userId = req.session.user.id;

  const query = `
    SELECT jobs.title, jobs.budget, jobs.deadline, applications.proposal, applications.created_at
    FROM applications
    JOIN jobs ON applications.job_id = jobs.id
    WHERE applications.user_id = ?
    ORDER BY applications.created_at DESC
  `;

  db.all(query, [userId], (err, applications) => {
    if (err) {
      console.error("Error fetching applications:", err);
      return res.status(500).send("Server error while fetching applications.");
    }
    res.render('my-applications', {
      user: req.session.user,
      applications,
      currentPage: 'my-applications'
    });
  });
});

app.get('/job-applicants/:jobId', verifyToken, (req, res) => {
  const userId = req.session.user.id;
  const jobId = req.params.jobId;

  const jobQuery = `SELECT * FROM jobs WHERE id = ? AND user_id = ?`;

  db.get(jobQuery, [jobId, userId], (err, job) => {
    if (err || !job) {
      return res.status(404).send('Job not found or unauthorized.');
    }

    const applicantQuery = `
      SELECT applications.proposal, applications.created_at, users.name, users.email, users.profilePic
      FROM applications
      JOIN users ON applications.user_id = users.id
      WHERE applications.job_id = ?
      ORDER BY applications.created_at DESC
    `;

    db.all(applicantQuery, [jobId], (err, applicants) => {
      if (err) {
        console.error("Error fetching applicants:", err);
        return res.status(500).send("Server error while fetching applicants.");
      }

      res.render('job-applicants', {
        user: req.session.user,
        applicants,
        job,
        currentPage: 'job-applicants'
      });
    });
  });
});

// GET /forum - Show all threads
app.get('/forum', verifyToken, (req, res) => {
  db.all(`
    SELECT forum_threads.*, users.name AS user_name
    FROM forum_threads
    JOIN users ON forum_threads.user_id = users.id
    ORDER BY created_at DESC
  `, (err, threads) => {
    if (err) {
      console.error('Error loading threads:', err);
      return res.status(500).send("Failed to load forum.");
    }
    res.render('forum', {
      user: req.session.user,
      threads
    });
  });
});

// POST /forum/post - Create a new thread
app.post('/forum/post', verifyToken, (req, res) => {
  const { title, category, content } = req.body;
  const userId = req.session.user.id;

  if (!title || !category || !content) {
    return res.status(400).send("All fields are required.");
  }

  db.run(`
    INSERT INTO forum_threads (user_id, title, category, content)
    VALUES (?, ?, ?, ?)`,
    [userId, title, category, content],
    (err) => {
      if (err) {
        console.error('Error saving thread:', err);
        return res.status(500).send("Failed to post thread.");
      }
      res.redirect('/forum');
    }
  );
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
