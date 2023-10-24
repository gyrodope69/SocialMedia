const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: 'backend/config/config.env' });
}

// Using middlewares
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Importing routes
const post = require('./routes/post');
const user = require('./routes/user');

// using routes
app.use('/api/v1', post);
app.use('/api/v1', user);

// app.use(express.static(path.join(__dirname, '../frontend/build')));

// app.get('*', (req, res) => {
//   res.sendFile(path.resolve(__dirname, '../frontend/build/index.html'));
// });

module.exports = app;
