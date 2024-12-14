const express = require('express');
const router = express.Router();
const penjualanController = require('../controllers/penjualanController'); // Pastikan path ini benar sesuai struktur project kamu

// Route untuk menambahkan data ke tabel unsold
// router.post('/addunsold/:id_karyawan', penjualanController.addUnsold);

// // Route untuk mendapatkan semua data unsold
// router.get('/getunsold', penjualanController.getAllUnsold);

// // Route untuk mendapatkan data unsold berdasarkan id_karyawan dengan pagination
// router.get('/getunsoldid/:id_karyawan', penjualanController.handleUnsold);
router.post('/sellkoins/:id_koin', penjualanController.sellKoin)
router.get('/getpenjualan', penjualanController.getAllKoinPenjualan)
router.get('/getnama', penjualanController.getKaryawanList)

module.exports = router;
