const crypto = require('crypto');
const connection = require('../models/database'); // Sesuaikan dengan path koneksi database Anda

// Fungsi untuk menambahkan admin
exports.addAdmin = (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Menggunakan MD5 untuk hashing password
  const hashedPassword = crypto.createHash('md5').update(password).digest('hex');

  const query = 'INSERT INTO admin (username, password) VALUES (?, ?)';
  connection.query(query, [username, hashedPassword], (err, result) => {
    if (err) {
      console.error('Error inserting admin data: ', err);
      return res.status(500).json({ error: 'Error inserting admin data' });
    }

    return res.json({
      success: true,
      message: 'Admin added successfully',
      data: { username }
    });
  });
};


// Fungsi untuk mengupdate password admin
exports.updateAdminPassword = (req, res) => {
  const { username, newPassword } = req.body;

  if (!username || !newPassword) {
    return res.status(400).json({ error: 'Username and new password are required' });
  }

  bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
    if (err) {
      console.error('Error hashing password: ', err);
      return res.status(500).json({ error: 'Error hashing password' });
    }

    const query = 'UPDATE admin SET password = ? WHERE username = ?';
    connection.query(query, [hashedPassword, username], (err, result) => {
      if (err) {
        console.error('Error updating admin password: ', err);
        return res.status(500).json({ error: 'Error updating password' });
      }

      return res.json({
        success: true,
        message: 'Password updated successfully',
        data: { username }
      });
    });
  });
};
exports.getAllData = (req, res) => {
  const query = `
    SELECT 
      karyawan.nama, 
      karyawan.waktu_login, 
      koin.jumlah_awal, 
      koin.jumlah_dijual, 
      koin.jumlah_sisa, 
      akun_steam.akun AS akun_steam, 
      akun_gmail.akun AS akun_gmail, 
      transaksi.shift
    FROM karyawan
    JOIN koin ON karyawan.id_karyawan = koin.id_karyawan
    JOIN transaksi ON karyawan.id_karyawan = transaksi.id_karyawan
    LEFT JOIN akun_karyawan akun_steam ON transaksi.id_akun = akun_steam.id_akun AND akun_steam.jenis_akun = 'steam'
    LEFT JOIN akun_karyawan akun_gmail ON transaksi.id_akun = akun_gmail.id_akun AND akun_gmail.jenis_akun = 'gmail'
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error querying database: ', err);
      return res.status(500).json({ error: 'Error querying database' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'No data found' });
    }

    return res.json(results); // Kirimkan hasil data gabungan
  });
};
