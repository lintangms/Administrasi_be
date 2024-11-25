const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const connection = require('../models/database');  // Sesuaikan dengan path ke file koneksi database Anda

exports.adminLogin = (req, res) => {
    const { username, password } = req.body;

    // Validasi input
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    // Query untuk mengambil data admin berdasarkan username
    const query = 'SELECT * FROM admin WHERE username = ?';
    connection.query(query, [username], (err, results) => {
        if (err) {
            console.error('Error querying database: ', err);
            return res.status(500).json({ error: 'Error querying database' });
        }

        if (results.length === 0) {
            // Jika admin tidak ditemukan
            return res.status(404).json({ error: 'Admin not found' });
        }

        const admin = results[0];

        // Debug log untuk memeriksa password yang disimpan di database
        console.log('Stored hashed password: ', admin.password);

        // Hash password yang dimasukkan dengan MD5
        const hashedPassword = crypto.createHash('md5').update(password).digest('hex');

        // Verifikasi password yang dimasukkan dengan password yang di-hash
        if (hashedPassword !== admin.password) {
            console.log('Password mismatch');
            return res.status(400).json({ error: 'Invalid password' });
        }

        // Jika password cocok, buat JWT token
        const token = jwt.sign(
            { id: admin.id, username: admin.username, role: 'admin' }, // Sertakan role dalam payload token
            'your_jwt_secret_key', 
            { expiresIn: '1h' }
        );

        // Kirimkan token JWT
        return res.json({
            success: true,
            message: 'Login successful',
            token: token
        });
    });
};