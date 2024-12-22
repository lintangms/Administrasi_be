const express = require('express');
const router = express.Router();
const unsoldController = require('../controllers/unsoldController'); // Pastikan path ini benar sesuai struktur project kamu

// Route untuk menambahkan data ke tabel unsold
router.post('/addunsold/:id_karyawan', unsoldController.addUnsold);

// Route untuk mendapatkan semua data unsold
router.get('/getunsold', unsoldController.getAllUnsold);
router.get('/getunsoldid/:id_karyawan', unsoldController.handleUnsold);
router.put('/sellunsold/:id_unsold', unsoldController.sellKoin)
router.post('/updateunsold/:id_unsold', unsoldController.updateUnsoldRate)
router.post('/updateallunsold', unsoldController.updateAllUnsoldRate)
// router.get('/totalunsold', unsoldController.getTotals )

module.exports = router;
