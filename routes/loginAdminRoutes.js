// routes/loginRoutes.js
const express = require('express');
const router = express.Router();

// Impor controller login admin
const loginAdminController = require('../controllers/loginAdminController');

// Definisikan route untuk login admin
router.post('/loginadmin', loginAdminController.adminLogin);

// Ekspor router untuk digunakan di server
module.exports = router;
