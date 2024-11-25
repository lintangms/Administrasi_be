const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController'); // Pastikan path ini benar

// Route untuk menambahkan admin
router.post('/add-admin', adminController.addAdmin);

// Route untuk update password admin
router.post('/update-admin-password', adminController.updateAdminPassword);

router.get('/data', adminController.getAllData);

// Pastikan Anda mengekspor router dengan benar
module.exports = router;
