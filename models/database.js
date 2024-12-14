const mysql = require('mysql2');
require('dotenv').config(); // Pastikan dotenv di-load di awal file

// Membuat koneksi ke database
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Cek koneksi awal
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL: ', err);
  } else {
    console.log('Connected to MySQL');
  }
});

// Menangani error koneksi
connection.on('error', (err) => {
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.error('Database connection lost. Reconnecting...');
    connection.connect((reconnectErr) => {
      if (reconnectErr) {
        console.error('Error reconnecting to MySQL:', reconnectErr);
      } else {
        console.log('Reconnected to MySQL');
      }
    });
  } else {
    console.error('Database error:', err);
  }
});

// Export connection untuk digunakan di tempat lain
module.exports = connection;
