const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
const server = process.env.SERVER;
if (server === 'true') {
     app.use((req, res, next) => {
          res.header('Access-Control-Allow-Origin', '*');
          res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
          next();
     });
}

app.use(cors({
     origin: ['http://localhost:5173', 'https://kellikai.web.app', 'https://kellikai.onrender.com'],
     methods: ['GET', 'POST', 'PUT', 'DELETE'],
     allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

const db = mysql.createPool({
     host: 'kellikai-kellikai-03.h.aivencloud.com',
     user: 'avnadmin',
     port: 26379,
     password: 'AVNS_X67sldgYke2sOkQBVK5',
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

const uploadDir = path.join(__dirname, '/uploads');
if (!fs.existsSync(uploadDir)) {
     fs.mkdirSync(uploadDir, { recursive: true });
}

app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
     destination: (req, file, cb) => {
          cb(null, uploadDir);
     },
     filename: (req, file, cb) => {
          const uniqueName = Date.now() + path.extname(file.originalname);
          cb(null, uniqueName);
     },
});
const upload = multer({ storage });

// Home route
app.get('/', async (req, res) => {
     try {
          const [rows] = await db.query('SELECT * FROM users');
          res.send(rows);
     } catch (err) {
          console.error(err);
          res.status(500).send('Error retrieving data from the database');
     }
});

// User registration
app.post('/register', upload.single('user_photo'), async (req, res) => {
     try {
          console.log("Register request:", req.body);

          const { name, email, password } = req.body;

          if (!req.file) {
               return res.status(400).send('User photo is required');
          }

          // Dynamically generate the user photo URL
          const user_photo = `https://kellikai.onrender.com/uploads/${req.file.filename}`;

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
          console.error('Error during registration:', err);
          res.status(500).send('Error registering user');
     }
});

// User login
app.post('/login', async (req, res) => {
     try {
          const { email, password } = req.body;
          console.log('Login request body:', req.body);
          const [rows] = await db.query('SELECT * FROM users WHERE name = ? OR email = ?', [email, email]);
          if (rows.length === 0) {
               return res.status(401).send('Invalid email or password');
          }

          const user = rows[0];

          res.send({
               id: user.id,
               name: user.name,
               email: user.email,
               user_photo: user.user_photo
                    ? user.user_photo
                    : `https://kellikai.onrender.com/uploads/${user.user_photo}`,
          });
     } catch (err) {
          console.error('Error during login:', err);
          res.status(500).send('Error logging in user');
     }
});

// Google login
app.post('/googlelogin', async (req, res) => {
     try {
          console.log('Google login request body:', req.body);
          const { name, email, photo } = req.body;

          const user_photo = photo

          const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
          if (rows.length === 0) {
               const [insert] = await db.query(
                    'INSERT INTO users (name, email, password, user_photo) VALUES (?, ?, ?, ?)',
                    [name, email, '', user_photo]
               );
               if (insert.affectedRows === 0) {
                    res.status(400).send('Failed to register user');
               } else {
                    res.send('User registered successfully');
               }
          } else {
               res.send(rows[0]);
          }
     } catch (err) {
          console.error('Error during Google login:', err);
          res.status(500).send('Error during Google login');
     }
});

// Facebook login
app.post('/facebooklogin', async (req, res) => {
     try {
          console.log('Facebook login request body:', req.body);
          const { name, email, photo } = req.body;

          const user_photo = photo;

          const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
          if (rows.length === 0) {
               const [insert] = await db.query(
                    'INSERT INTO users (name, email, password, user_photo) VALUES (?, ?, ?, ?)',
                    [name, email, '', user_photo]
               );
               if (insert.affectedRows === 0) {
                    res.status(400).send('Failed to register user');
               } else {
                    res.send('New user created successfully');
               }
          } else {
               res.send(rows[0]);
          }
     } catch (err) {
          console.error('Error during Facebook login:', err);
          res.status(500).send('Error during Facebook login');
     }
});

// Upload a post
app.post('/uploadpost', upload.single('image'), async (req, res) => {
     try {
          console.log('Request body:', req.body);
          console.log('Uploaded file:', req.file.filename);
          const { name, caption } = req.body;
          const image = `https://kellikai.onrender.com/uploads/${req.file.filename}`;
          console.log('Image URL:', image);
          console.log('Image file:', image);
          const query = 'INSERT INTO post (name, img, caption) VALUES (?, ?, ?)';
          const [rows] = await db.query(query, [name, image, caption]);

          if (rows.affectedRows === 0) {
               res.status(400).send('Failed to create post');
          } else {
               res.send('Post created successfully');
          }
     } catch (err) {
          console.error(err);
          res.status(500).send('Error creating post');
     }
});

// Get all users
app.get('/getallusers', async (req, res) => {
     try {
          console.log('Request query:', req.query);
          const name = req.query.name;
          const [rows] = await db.query('SELECT id, name, user_photo FROM users WHERE name != ?', [name]);

          const users = rows.map((row) => ({
               id: row.id,
               name: row.name,
               user_photo: row.user_photo,
          }));

          res.send(users);
     } catch (err) {
          console.error(err);
          res.status(500).send('Error retrieving users');
     }
});

// Serve uploaded files
app.get('/uploads/:filename', (req, res) => {
     const { filename } = req.params;
     const filePath = `https://kellikai.onrender.com/uploads/` + filename;
     console.log('File path:', filePath);
     fs.readFile(filePath, (err, data) => {
          if (err) {
               res.status(500).send('Error reading file');
          } else {
               res.writeHead(200, { 'Content-Type': 'image/jpeg' });
               res.end(data);
          }
     });
});

app.get('/profilePic', async (req, res) => {
     try {
          const name = req.query.name;
          const [rows] = await db.query('SELECT user_photo FROM users WHERE name = ?', [name]);
          if (rows.length > 0) {
               const userPhoto = rows[0].user_photo;
               res.send(userPhoto);
               console.log('User photo URL:', userPhoto);
          } else {
               res.status(404).send('User not found');
          }
     } catch (err) {
          console.error(err);
          res.status(500).send('Error retrieving profile picture');
     }
});

// Retrieve all posts
app.get('/getallposts', async (req, res) => {
     try {
          const [rows] = await db.query(`
            SELECT 
                post.id,
                users.user_photo,
                post.name,
                post.img,
                post.caption,
                post.likes
            FROM 
                post
            JOIN 
                users ON post.name = users.name
            ORDER BY 
                post.priority DESC;
        `);

          const posts = rows.map((row) => ({
               id: row.id,
               name: row.name,
               profile: row.user_photo,
               img: row.img,
               caption: row.caption,
               likes: row.likes,
          }));
          console.log('Posts:', posts);

          res.send(posts);
     } catch (err) {
          console.error(err);
          res.status(500).send('Error retrieving posts');
     }
});

app.get('/followings', async (req, res) => {
     try {
          const followerId = req.query.follower_id;

          if (!followerId) {
               return res.status(400).send('Follower ID is required');
          }

          const [rows] = await db.query(`
            SELECT 
                u.id,
                u.name,
                u.user_photo
            FROM 
                followings f
            JOIN 
                users u ON f.followed_id = u.id
            WHERE 
                f.follower_id = ?;
        `, [followerId]);

          const followings = rows.map((row) => ({
               id: row.id,
               name: row.name,
               user_photo: row.user_photo,
          }));

          res.send(followings);
     } catch (err) {
          console.error('Error retrieving followings:', err);
          res.status(500).send('Error retrieving followings');
     }
});

app.delete('/unfollow', async (req, res) => {
     try {
          const { follower_id, following_id } = req.query;
          console.log('Follower ID:', follower_id);
          console.log('Following ID:', following_id);

          if (!follower_id || !following_id) {
               return res.status(400).send('Follower ID and Following ID are required');
          }

          const [result] = await db.query(
               'DELETE FROM followings WHERE follower_id = ? AND followed_id = ?',
               [follower_id, following_id]
          );

          if (result.affectedRows === 0) {
               return res.status(404).send('No such following found');
          }

          res.send('User unfollowed successfully');
     } catch (err) {
          console.error('Error unfollowing user:', err);
          res.status(500).send('Error unfollowing user');
     }
});

app.post('/followuser', async (req, res) => {
     try {
          console.log('Request body:', req.body);
          const { follower_id, followed_id } = req.body;

          if (!follower_id || !followed_id) {
               console.error('Missing follower_id or followed_id in the request body');
               return res.status(400).send('Follower ID and Followed ID are required');
          }

          console.log('Follower ID:', follower_id);
          console.log('Followed ID:', followed_id);

          const [existingFollow] = await db.query(
               'SELECT * FROM followings WHERE follower_id = ? AND followed_id = ?',
               [follower_id, followed_id]
          );

          if (existingFollow.length > 0) {
               console.log('User is already followed');
               return res.status(409).send('Already following this user');
          }

          const [result] = await db.query(
               'INSERT INTO followings (follower_id, followed_id) VALUES (?, ?)',
               [follower_id, followed_id]
          );

          if (result.affectedRows === 0) {
               console.error('Failed to insert follow relationship into the database');
               return res.status(400).send('Failed to follow user');
          }

          console.log('Follow relationship added successfully');
          res.send('User followed successfully');
     } catch (err) {
          console.error('Error following user:', err);
          res.status(500).send('Error following user');
     }
});

app.post('/likepost', async (req, res) => {
    try {
        const { post_id, user_id } = req.body;

        if (!post_id || !user_id) {
            return res.status(400).send('Post ID and User ID are required');
        }

        // Check if the user has already liked the post
        const [existingLike] = await db.query(
            'SELECT * FROM post_likes WHERE post_id = ? AND user_id = ?',
            [post_id, user_id]
        );

        if (existingLike.length > 0) {
            return res.status(409).send('User has already liked this post');
        }

        // Insert the like into the post_likes table
        const [likeResult] = await db.query(
            'INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)',
            [post_id, user_id]
        );

        if (likeResult.affectedRows === 0) {
            return res.status(400).send('Failed to like the post');
        }

        // Increment the likes count in the post table
        const [updateResult] = await db.query(
            'UPDATE post SET likes = likes + 1 WHERE id = ?',
            [post_id]
        );

        if (updateResult.affectedRows === 0) {
            return res.status(404).send('Post not found');
        }

        res.send('Post liked successfully');
    } catch (err) {
        console.error('Error liking post:', err);
        res.status(500).send('Error liking post');
    }
});
app.listen(port, () => {
     console.log(`Server is running on port ${port}`);
});
