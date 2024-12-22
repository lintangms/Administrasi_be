const express = require('express');
const router = express.Router();
const gajiController = require('../controllers/gajiController');

// Endpoint untuk menambahkan kasbon
router.get('/getgaji', gajiController.getKaryawanGajiDetails);
router.put('/updategaji/:id_gaji', gajiController.updateGaji)
// router.get('/getallgaji', gajiController.getAllGaji)
router.get('/datagaji', gajiController.getGajiAll)
router.post('/addgaji', gajiController.addGaji)
router.get('/getnama', gajiController.getKaryawanList)
// // Endpoint untuk mendapatkan semua kasbon
// router.get('/allkasbon', kasbonController.getAllKasbon);

// // Endpoint untuk mendapatkan kasbon berdasarkan ID karyawan
// router.get('/kasbon/:id_karyawan', kasbonController.getKasbonByKaryawan);
// router.put('/updatekasbon/:id_kasbon', kasbonController.updateKasbonStatusByIdKasbon);


module.exports = router;
