const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;


app.use(cors());
app.use(express.json());

// Database Connection
const db = mysql.createPool({
     host: 'kellikai-kellikai-03.h.aivencloud.com',
     user: 'avnadmin',
     port: 26379,
     password: 'AVNS_RLdK5kJ2UBDb4vsLWYa',
     database: 'kellikai',
});

db.getConnection()
     .then((connection) => {
          console.log('Connected to the database');
          connection.release();
     })
     .catch((err) => {
          console.error('Error connecting to the database:', err);
          process.exit(1);
     });

// File Upload Configuration
const uploadDir = path.join(__dirname, '/uploads');
if (!fs.existsSync(uploadDir)) {
     fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
     destination: (req, file, cb) => cb(null, uploadDir),
     filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// Helper Functions
const queryDatabase = async (query, params) => {
     try {
          const [rows] = await db.query(query, params);
          return rows;
     } catch (err) {
          console.error('Database query error:', err);
          throw new Error('Database error');
     }
};

const handleError = (res, err, message = 'An error occurred') => {
     console.error(message, err);
     res.status(500).send(message);
};

// Routes

// Home Route
app.get('/', async (req, res) => {
     try {
          const users = await queryDatabase('SELECT * FROM users', []);
          res.send(users);
     } catch (err) {
          handleError(res, err, 'Error retrieving users');
     }
});

// User Registration
app.post('/register', upload.single('user_photo'), async (req, res) => {
     try {
          const { name, email, password } = req.body;
          const user_photo = req.file ? `https://kellikai.onrender.com/uploads/` + req.file.filename : null; // Get the uploaded file name


          const [rows] = await db.query('SELECT * FROM users WHERE email = ? OR name = ?', [email, name]);
          if (rows.length === 0) {
               const [insert] = await db.query(
                    'INSERT INTO users (name, email, password, user_photo) VALUES (?, ?, ?, ?)',
                    [name, email, password, user_photo]
               );
               if (insert.affectedRows === 0) {
                    res.status(400).send('Failed to register user');
               } else {
                    res.send('User registered successfully');
               }
          } else {
               res.status(409).send('User already exists');
          }
     } catch (err) {
          console.error(err);
          res.status(500).send('Error registering user');
     }
});

// User login
app.post('/login', async (req, res) => {
     try {
          const { email, password } = req.body;

          // Check if the user exists
          const [rows] = await db.query('SELECT * FROM users WHERE name = ? or email = ?', [email, email]);
          if (rows.length === 0) {
               return res.status(401).send('Invalid email or password');
          }

          const user = users[0];
          res.send({
               id: user.id,
               name: user.name,
               email: user.email,
               user_photo: user.user_photo,
          });
     } catch (err) {
          handleError(res, err, 'Error logging in user');
     }
});

// Google Login
app.post('/googlelogin', async (req, res) => {
     try {
          const { name, email, photo } = req.body;
          const users = await queryDatabase('SELECT * FROM users WHERE email = ?', [email]);

          if (users.length === 0) {
               const result = await queryDatabase(
                    'INSERT INTO users (name, email, password, user_photo) VALUES (?, ?, ?, ?)',
                    [name, email, '', photo]
               );

               if (result.affectedRows === 0) return res.status(400).send('Failed to register user');
               return res.send('User registered successfully');
          }

          res.send(users[0]);
     } catch (err) {
          handleError(res, err, 'Error during Google login');
     }
});

// Facebook Login
app.post('/facebooklogin', async (req, res) => {
     try {
          console.log('Facebook login request body:', req.body); // Log the request body for debugging
          const { name, email, photo } = req.body;
          const users = await queryDatabase('SELECT * FROM users WHERE email = ?', [email]);

          if (users.length === 0) {
               const result = await queryDatabase(
                    'INSERT INTO users (name, email, password, user_photo) VALUES (?, ?, ?, ?)',
                    [name, email, '', photo]
               );

               if (result.affectedRows === 0) return res.status(400).send('Failed to register user');
               return res.send('New user created successfully');
          }

          res.send(users[0]);
     } catch (err) {
          handleError(res, err, 'Error during Facebook login');
     }
});

// Like Post
app.post('/likepost', async (req, res) => {
     try {
          const name = req.query.name;
          const [rows] = await db.query('SELECT id,name, user_photo FROM users WHERE name != ?', [name]);

          const result = await queryDatabase('UPDATE post SET likes = likes + 1 WHERE id = ?', [post_id]);
          if (result.affectedRows === 0) return res.status(404).send('Post not found');

          res.send('Post liked successfully');
     } catch (err) {
          handleError(res, err, 'Error liking post');
     }
});

// Serve Uploaded Files
app.get('/uploads/:filename', (req, res) => {
     const { filename } = req.params;
     const filePath = path.join(uploadDir, filename);

     fs.readFile(filePath, (err, data) => {
          if (err) {
               if (err.code === 'ENOENT') return res.status(404).send('File not found');
               return res.status(500).send('Error reading file');
          }

          res.writeHead(200, { 'Content-Type': 'image/jpeg' });
          res.end(data);
     });
});

// Start Server
app.listen(port, () => {
     console.log(`Server is running on port ${port}`);
});
