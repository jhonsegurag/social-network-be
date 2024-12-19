'use strict';

var express = require('express');
var PublicationController = require('../controllers/publication');
var api = express.Router();
var md_auth = require('../middlewares/authenticated');

api.post('/publication', md_auth.ensureAuth, PublicationController.savePublication);
api.get('/publications/:page?', md_auth.ensureAuth, PublicationController.getPublications);
api.get('/publications-user/:user/:page?', md_auth.ensureAuth, PublicationController.getPublicationsUser);
api.get('/publication/:id', md_auth.ensureAuth, PublicationController.getPublication);
api.delete('/publication/:id', md_auth.ensureAuth, PublicationController.deletePublication);
api.post('/upload-image-pub/:id', [md_auth.ensureAuth], PublicationController.uploadImageMigrate);
api.get('/get-image-pub/:imageFile', PublicationController.getImageFile);

module.exports = api;
