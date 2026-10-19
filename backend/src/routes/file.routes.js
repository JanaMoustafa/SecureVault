'use strict';

const express    = require('express');
const auth       = require('../middleware/authenticate');
const controller = require('../controllers/file.controller');

const router = express.Router();

// All file routes require authentication (Zero-Trust)
router.use(auth);

router.post('/upload',          controller.uploadFile);
router.get('/',                 controller.listFiles);
router.get('/:id',              controller.getFile);
router.get('/:id/download',     controller.downloadFile);
router.delete('/:id',           controller.deleteFile);

module.exports = router;
