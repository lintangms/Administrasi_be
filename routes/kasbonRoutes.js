const express = require('express');
const router = express.Router();
const kasbonController = require('../controllers/kasbonController');

// Endpoint untuk menambahkan kasbon
router.post('/addkasbon/:id_karyawan', kasbonController.addKasbon);

// Endpoint untuk mendapatkan semua kasbon
router.get('/allkasbon', kasbonController.getAllKasbon);

// Endpoint untuk mendapatkan kasbon berdasarkan ID karyawan
router.get('/kasbon/:id_karyawan', kasbonController.getKasbonByKaryawan);

module.exports = router;
