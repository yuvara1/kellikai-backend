const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const multer = require('multer');
const axios = require('axios');
dotenv.config();

const app = express();
const port = 3000;

// Middleware
app.use((req, res, next) => {
     res.header('Access-Control-Allow-Origin', '*');
     res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
     next();
});

const server = process.env.SERVER;
if (server === 'true') {
     app.use((req, res, next) => {
          res.header('Access-Control-Allow-Origin', '*');
          res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
          next();
     });
}

app.use(cors({
     origin: ['http://localhost:5173', 'https://kellikai.web.app'],
     methods: ['GET', 'POST', 'PUT', 'DELETE'],
     credentials: true,
}));

app.use(express.json());

const db = mysql.createPool({
     host: process.env.DB_HOST, // <-- use env variable here
     user: process.env.DB_USER,
     port: process.env.DB_PORT,
     password: process.env.DB_PASSWORD,
     database: process.env.DB_NAME,
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

// Use memory storage to store files in memory as buffers
const storage = multer.memoryStorage();

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

// Registration
app.post('/register', upload.single('user_photo'), async (req, res) => {
     try {
          const { name, email, password } = req.body;
          if (!req.file) {
               return res.status(400).send('User photo is required');
          }
          const user_photo = req.file.buffer; // Buffer for LONGBLOB

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
                    ? `data:image/jpeg;base64,${Buffer.from(user.user_photo).toString('base64')}`
                    : null,
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

          // Download the image from the photo URL and convert to buffer
          let user_photo = null;
          if (photo) {
               const response = await axios.get(photo, { responseType: 'arraybuffer' });
               user_photo = Buffer.from(response.data, 'binary');
          }

          const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
          if (rows.length === 0) {
               const [insert] = await db.query(
                    'INSERT INTO users (name, email, password, user_photo) VALUES (?, ?, ?, ?)',
                    [name, email, '', user_photo]
               );
               if (insert.affectedRows === 0) {
                    res.status(400).send('Failed to register user');
               } else {
                    // Return the new user info
                    const [newUserRows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
                    res.send(newUserRows[0]);
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
          const { name, caption } = req.body;
          if (!req.file) {
               return res.status(400).send('Image is required');
          }
          // Convert buffer to base64 string
          const base64Image = req.file.buffer.toString('base64');
          const mimetype = req.file.mimetype;

          const query = 'INSERT INTO post (name, img, mimetype, caption) VALUES (?, ?, ?, ?)';
          const [rows] = await db.query(query, [name, base64Image, mimetype, caption]);

          if (rows.affectedRows === 0) {
               res.status(400).send('Failed to create post');
          } else {
               res.send('Post created successfully');
          }
     } catch (err) {
          console.error('Error creating post:', err);
          res.status(500).send('Error creating post');
     }
});
// Get all users
app.get('/getallusers', async (req, res) => {
     try {
          const name = req.query.name;
          const [rows] = await db.query('SELECT id, name, user_photo FROM users WHERE name != ?', [name]);
          const users = rows.map((row) => ({
               id: row.id,
               name: row.name,
               user_photo: row.user_photo
                    ? `data:image/jpeg;base64,${Buffer.from(row.user_photo).toString('base64')}`
                    : null,
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
     const filePath = `${server}` + filename;
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
               if (!userPhoto) {
                    return res.status(404).send('User photo not found');
               }
               // Convert binary to base64 Data URL
               const base64Photo = `data:image/jpeg;base64,${userPhoto.toString('base64')}`;
               res.send(base64Photo);
          } else {
               res.status(404).send('User not found');
          }
     } catch (err) {
          console.error('Error retrieving profile picture:', err);
          res.status(500).send('Error retrieving profile picture');
     }
});

// Retrieve all posts
app.get('/getallposts', async (req, res) => {
     try {
          const user_id = req.query.user_id;
          const limit = parseInt(req.query.limit) || 5;
          const offset = parseInt(req.query.offset) || 0;

          // Get total count for frontend
          const [[{ count }]] = await db.query(`
            SELECT COUNT(*) as count
            FROM post
            JOIN users ON post.name = users.name
          `);

          // Get paginated posts
          const [rows] = await db.query(`
            SELECT 
                post.id,
                users.user_photo,
                post.name,
                post.img,
                post.mimetype,
                post.caption,
                post.likes
            FROM 
                post
            JOIN 
                users ON post.name = users.name
            ORDER BY 
                post.priority DESC
            LIMIT ? OFFSET ?
          `, [limit, offset]);

          // Get liked post ids for this user
          let likedPosts = [];
          if (user_id) {
               const [likedRows] = await db.query(
                    'SELECT post_id FROM post_likes WHERE user_id = ?',
                    [user_id]
               );
               likedPosts = likedRows.map(row => row.post_id);
          }

          const posts = rows.map((row) => ({
               id: row.id,
               name: row.name,
               profile: row.user_photo
                    ? `data:image/jpeg;base64,${Buffer.from(row.user_photo).toString('base64')}`
                    : null,
               img: row.img && row.mimetype ? `data:${row.mimetype};base64,${row.img}` : null,
               caption: row.caption,
               likes: row.likes,
               liked: user_id ? likedPosts.includes(row.id) : false
          }));

          res.send({
               posts,
               total: count
          });
     } catch (err) {
          console.error('Error retrieving posts:', err);
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
               user_photo: row.user_photo
                    ? `data:image/jpeg;base64,${Buffer.from(row.user_photo).toString('base64')}`
                    : null,
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

          // Check if the user already liked the post
          const [existing] = await db.query(
               'SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?',
               [post_id, user_id]
          );
          if (existing.length > 0) {
               return res.status(409).send('User already liked this post');
          }

          // Insert into post_likes
          await db.query(
               'INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)',
               [post_id, user_id]
          );

          // Increment the like count
          const [result] = await db.query(
               'UPDATE post SET likes = likes + 1 WHERE id = ?',
               [post_id]
          );

          if (result.affectedRows === 0) {
               return res.status(404).send('Post not found');
          }

          res.send('Post liked successfully');
     } catch (err) {
          console.error('Error liking post:', err);
          res.status(500).send('Error liking post');
     }
});

app.post('/unlikepost', async (req, res) => {
     try {
          const { post_id, user_id } = req.body;

          if (!post_id || !user_id) {
               return res.status(400).send('Post ID and User ID are required');
          }

          // Check if the user has liked the post
          const [existing] = await db.query(
               'SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?',
               [post_id, user_id]
          );
          if (existing.length === 0) {
               return res.status(409).send('User has not liked this post');
          }

          // Remove from post_likes
          await db.query(
               'DELETE FROM post_likes WHERE post_id = ? AND user_id = ?',
               [post_id, user_id]
          );

          // Decrement the like count (but not below zero)
          await db.query(
               'UPDATE post SET likes = GREATEST(likes - 1, 0) WHERE id = ?',
               [post_id]
          );

          res.send('Post unliked successfully');
     } catch (err) {
          console.error('Error unliking post:', err);
          res.status(500).send('Error unliking post');
     }
});

app.get('/getimage/:id', async (req, res) => {
     try {
          const { id } = req.params;

          const [rows] = await db.query('SELECT img FROM post WHERE id = ?', [id]);

          if (rows.length === 0) {
               return res.status(404).send('Image not found');
          }

          const imageBuffer = rows[0].img;

          if (!imageBuffer) {
               return res.status(404).send('Image not found');
          }

          // Convert the binary data to a Base64 string
          const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
          res.send(base64Image);
     } catch (err) {
          console.error('Error retrieving image:', err);
          res.status(500).send('Error retrieving image');
     }
});
app.listen(port, () => {
     console.log(`Server is running on port ${port}`);
});
