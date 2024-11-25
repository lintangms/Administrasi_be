require('dotenv').config();
const mysql = require('mysql2');

const dbConfig = {
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
};

// Tambahkan username dan password hanya jika tersedia
if (process.env.DB_USER) dbConfig.user = process.env.DB_USER;
if (process.env.DB_PASSWORD) dbConfig.password = process.env.DB_PASSWORD;

const db = mysql.createConnection(dbConfig);

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    process.exit(1);
  } else {
    console.log('Connected to MySQL database');
  }
});

module.exports = db;
