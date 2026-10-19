'use strict';

const express    = require('express');
const auth       = require('../middleware/authenticate');
const authorize  = require('../middleware/authorize');
const controller = require('../controllers/admin.controller');

const router = express.Router();

// All admin routes require authentication AND admin role
router.use(auth, authorize('admin'));

router.get('/users',                    controller.listUsers);
router.patch('/users/:id/status',       controller.toggleUserStatus);
router.patch('/users/:id/role',         controller.changeRole);
router.get('/stats',                    controller.getStats);

module.exports = router;
