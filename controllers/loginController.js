const jwt = require('jsonwebtoken');
const connection = require('../models/database');

exports.login = (req, res) => {
  const { kode_akun } = req.body;
  const loginTime = new Date();

  // Query hanya berdasarkan kode_akun
  const query = 'SELECT * FROM karyawan WHERE kode_akun = ?';
  connection.query(query, [kode_akun], (err, results) => {
    if (err) {
      console.error('Error querying database: ', err);
      return res.status(500).json({ error: 'Error querying database' });
    }

    if (results.length > 0) {
      // Membuat JWT token jika kode_akun ditemukan
      const token = jwt.sign({ id: results[0].id, kode_akun: results[0].kode_akun }, 'your_jwt_secret_key', { expiresIn: '1h' });

      // Update waktu login di database
      const updateQuery = 'UPDATE karyawan SET waktu_login = ? WHERE kode_akun = ?';
      connection.query(updateQuery, [loginTime, kode_akun], (err, updateResult) => {
        if (err) {
          console.error('Error updating login time: ', err);
          return res.status(500).json({ error: 'Error updating login time' });
        }

        // Kirim respons sukses
        return res.json({
          success: true,
          message: 'Login successful',
          token: token,
          user: results[0], // Kirim data pengguna
          loginTime: loginTime.toISOString()
        });
      });
    } else {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
  });
};