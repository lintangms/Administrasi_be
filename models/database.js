// models/database.js
const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root', // Sesuaikan dengan username MySQL Anda
  password: '', // Kosongkan jika tidak ada password
  database: 'harvest' // Ganti dengan nama database yang sesuai
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL: ', err);
  } else {
    console.log('Connected to MySQL');
  }
});

module.exports = connection;
