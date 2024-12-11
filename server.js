// server.js
require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const userRoutes = require('./routes/userRoutes');
const loginRoutes = require('./routes/loginRoutes');
const transaksiRoutes = require('./routes/transaksiRoutes');
const koinRoutes = require('./routes/koinRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminLoginRoutes = require('./routes/loginAdminRoutes');
const kasbonRoutes = require('./routes/kasbonRoutes');  

// Middleware
app.use(bodyParser.json());
app.use(cors({
  origin: '*', // Atau kamu bisa mengganti dengan domain tertentu untuk keamanan, seperti https://d9e9-117-103-68-201.ngrok-free.app
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));


// Routes
app.use('/api', userRoutes);
app.use('/api', loginRoutes);
app.use('/transaksi', transaksiRoutes);
app.use('/api', koinRoutes);
app.use('/api', adminRoutes);
app.use('/api', adminLoginRoutes);
app.use('/api', kasbonRoutes);

// Start server
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
