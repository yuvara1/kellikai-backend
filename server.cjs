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

const db = mysql.createPool({
     host: 'kellikai-03-kellikai-03.h.aivencloud.com',
     user: 'avnadmin',
     port: 26379,
     password: 'AVNS_RLdK5kJ2UBDb4vsLWYa',
     database: 'kellikai',
     connectionLimit: 10,
});

db.getConnection()
     .then((connection) => {
          console.log('Connected to the database');
          connection.release();
     })
     .catch((err) => {
          console.error('Error connecting to the database:', err);
     });

const uploadDir = path.join(__dirname, '/uploads');
if (!fs.existsSync(uploadDir)) {
     fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve static files from the uploads directory
app.use('/uploads', express.static(uploadDir));

// Configure multer for file uploads
const storage = multer.diskStorage({
     destination: (req, file, cb) => {
          console.log('Saving to directory:', uploadDir);
          cb(null, uploadDir);
     },
     filename: (req, file, cb) => {
          const uniqueName = Date.now() + path.extname(file.originalname);
          console.log('Generated filename:', uniqueName);
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

          const user = rows[0];

          // Compare the hashed password
          console.log(user)

          // Send user data (excluding sensitive information like password)
          res.send({
               id: user.id,
               name: user.name,
               email: user.email,
               user_photo: user.user_photo
                    ? user.user_photo : `https://kellikai.onrender.com/uploads/${user.user_photo}`
          });
     } catch (err) {
          console.error('Error during login:', err);
          res.status(500).send('Error logging in user');
     }
});

// Google login
app.post('/googlelogin', async (req, res) => {
     try {
          console.log('Google login request body:', req.body); // Log the request body for debugging
          const { name, email, photo } = req.body;
          const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
          if (rows.length === 0) {
               const [insert] = await db.query(
                    'INSERT INTO users (name, email, password, user_photo) VALUES (?, ?, ?, ?)',
                    [name, email, '', photo]
               );
               if (insert.affectedRows === 0) {
                    res.status(400).send('Failed to register user');
               } else {
                    res.send('User registered successfully');
               }
          } else {
               console.log('User already exists:', rows[0]);
               console.log('users:', rows);
               res.send(rows[0]);
          }
     } catch (err) {
          console.error(err);
          res.status(500).send('Error during Google login');
     }
});

// Facebook login
app.post('/facebooklogin', async (req, res) => {
     try {
          const { name, email, photo } = req.body;
          const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
          if (rows.length === 0) {
               const [insert] = await db.query(
                    'INSERT INTO users (name, email, password, user_photo) VALUES (?, ?, ?, ?)',
                    [name, email, '', photo]
               );
               if (insert.affectedRows === 0) {
                    res.status(400).send('Failed to register user');
               } else {
                    res.send('New user created successfully');
               }
          } else {
               res.send(rows);
          }
     } catch (err) {
          console.error(err);
          res.status(500).send('Error during Facebook login');
     }
});

//upload a post
app.post('/uploadpost', upload.single('image'), async (req, res) => {
     try {
          console.log('Request body:', req.body); // Log the request body for debugging
          console.log('Uploaded file:', req.file.filename); // Log the uploaded file for debugging
          const { name, caption } = req.body;
          const image = `https://kellikai.onrender.com/uploads/${req.file.filename}`; // Get the uploaded file name 
          console.log('Image file:', image); // Log the image file name    
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
          const name = req.query.name;
          const [rows] = await db.query('SELECT id,name, user_photo FROM users WHERE name != ?', [name]);

          const users = rows.map((row) => ({
               id: row.id,
               name: row.name,
               user_photo: row.user_photo
                    ? row.user_photo : `https://kellikai.onrender.com/uploads/${row.user_photo}`,

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
     const filePath =  filename;
     console.log('File path:', filePath); // Log the file path for debugging
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
               const userPhoto = rows[0].user_photo ? rows[0].user_photo : `https://kellikai.onrender.com/uploads/${rows[0].user_photo}`;
               res.send(userPhoto);
          } else {
               res.status(404).send('User not found');
          }
     } catch (err) {
          console.error(err);
          res.status(500).send('Error retrieving profile picture');
     }
}
);

// Retrieve all posts
app.get('/getallposts', async (req, res) => {
     try {
          const [rows] = await db.query(`
     SELECT 
    post.id,
    users.user_photo AS userprofile,
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
               profile: row.userprofile,
               img: row.img,
               caption: row.caption,
               likes: row.likes,
          }));
          console.log('Posts:', posts); // Log the posts for debugging

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
          const { follower_id, following_id } = req.query; // Get the follower and following IDs from the query parameters
          console.log('Follower ID:', follower_id); // Log the follower ID for debugging
          console.log('Following ID:', following_id); // Log the following ID for debugging

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
}
);


app.post('/followuser', async (req, res) => {
     try {
          console.log('Request body:', req.body); // Log the request body for debugging
          const { follower_id, followed_id } = req.body;

          if (!follower_id || !followed_id) {
               console.error('Missing follower_id or followed_id in the request body');
               return res.status(400).send('Follower ID and Followed ID are required');
          }


          console.log('Follower ID:', follower_id); // Log the follower ID for debugging
          console.log('Followed ID:', followed_id); // Log the followed ID for debugging

          // Check if the user is already followed
          const [existingFollow] = await db.query(
               'SELECT * FROM followings WHERE follower_id = ? AND followed_id = ?',
               [follower_id, followed_id]
          );

          if (existingFollow.length > 0) {
               console.log('User is already followed');
               return res.status(409).send('Already following this user');
          }

          // Insert the new follow relationship
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
          const { post_id } = req.body;

          if (!post_id) {
               return res.status(400).send('Post ID is required');
          }

          // Increment the likes for the post
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

// Start the server
app.listen(port, () => {
     console.log(`Server is running on port ${port}`);
});
