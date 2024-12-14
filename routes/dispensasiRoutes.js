const express = require('express');
const router = express.Router();
const dispensasiControlller = require('../controllers/dispensasiController');

// Endpoint untuk menambahkan kasbon
router.post('/adddispen/:id_karyawan', dispensasiControlller.addDispensasi);

// Endpoint untuk mendapatkan semua kasbon
router.get('/alldispen', dispensasiControlller.getAllDispensasi);

// Endpoint untuk mendapatkan kasbon berdasarkan ID karyawan
router.get('/dispen/:id_karyawan', dispensasiControlller.getDispensasiByKaryawan);
router.put('/updatedispen/:id_dispensasi', dispensasiControlller.updateStatusDispensasiById);


module.exports = router;
