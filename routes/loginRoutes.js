// routes/loginRoutes.js
const express = require('express');
const router = express.Router();
const loginController = require('../controllers/loginController');
// const { route } = require('./userRoutes');

router.post('/login', loginController.login);

module.exports = router;
