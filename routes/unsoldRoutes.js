const express = require('express');
const router = express.Router();
const unsoldController = require('../controllers/unsoldController'); // Pastikan path ini benar sesuai struktur project kamu

// Route untuk menambahkan data ke tabel unsold
router.post('/addunsold/:id_karyawan', unsoldController.addUnsold);

// Route untuk mendapatkan semua data unsold
router.get('/getunsold', unsoldController.getAllUnsold);

// Route untuk mendapatkan data unsold berdasarkan id_karyawan dengan pagination
router.get('/getunsoldid/:id_karyawan', unsoldController.handleUnsold);
router.put('/sellunsold/:id_unsold', unsoldController.sellKoin)

module.exports = router;
