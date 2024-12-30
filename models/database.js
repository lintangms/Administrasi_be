const mysql = require('mysql2');
require('dotenv').config(); // Pastikan dotenv di-load di awal file

let connection;

// Fungsi untuk membuat koneksi baru
function createConnection() {
  connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  // Cek koneksi awal
  connection.connect((err) => {
    if (err) {
      console.error('Error connecting to MySQL:', err);
      setTimeout(createConnection, 2000); // Coba reconnect setelah 2 detik
    } else {
      console.log('Connected to MySQL');
    }
  });

  // Menangani error koneksi
  connection.on('error', (err) => {
    console.error('Database error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.log('Database connection lost. Reconnecting...');
      createConnection(); // Buat koneksi baru
    } else {
      throw err; // Lempar error jika bukan karena koneksi terputus
    }
  });
}

// Inisialisasi koneksi
createConnection();

// Export connection untuk digunakan di tempat lain
module.exports = connection;
