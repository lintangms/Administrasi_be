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
const dispensasiRoutes = require('./routes/dispensasiRoutes');
const unsoldRoutes = require('./routes/unsoldRoutes');
const penjualanRoutes = require('./routes/penjualanRoutes');
const gajiRoutes = require('./routes/gajiRoutes');

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
app.use('/api/transaksi', transaksiRoutes);
app.use('/api', koinRoutes);
app.use('/api', adminRoutes);
app.use('/api', adminLoginRoutes);
app.use('/api', kasbonRoutes);
app.use('/api', dispensasiRoutes);
app.use('/api', unsoldRoutes);
app.use('/api', penjualanRoutes);
app.use('/api', gajiRoutes);

// Start server
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
