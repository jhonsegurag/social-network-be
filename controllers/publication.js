'use strict';

const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const Publication = require('../models/publication');
const User = require('../models/user');
const Follow = require('../models/follow');
const upload = require('../middlewares/upload');
const pify = require('pify');

async function savePublication(req, res) {
    const params = req.body;
    if (!params.text) {
        return res.status(200).send({ message: 'Text field is required.' });
    }
    try {
        const publication = await Publication.create({
            text: params.text,
            file: null,
            userId: parseInt(req.user.sub),
        });
        return res.status(200).send({ publication });
    } catch (err) {
        return res.status(500).send({ message: 'Request Error.' });
    }
}

async function getPublications(req, res) {
    const selfId = parseInt(req.user.sub);
    const itemsPerPage = 10;
    const page = parseInt(req.params.page) || 1;
    const offset = (page - 1) * itemsPerPage;

    try {
        const followRows = await Follow.findAll({ where: { userId: selfId } });
        const followedIds = followRows.map(f => f.followedId);
        const userIds = [...followedIds, selfId];

        const { count, rows } = await Publication.findAndCountAll({
            where: { userId: { [Op.in]: userIds } },
            limit: itemsPerPage,
            offset,
            order: [['createdAt', 'DESC']],
            include: [{ model: User, as: 'author' }],
        });

        return res.status(200).send({
            total: count,
            pages: Math.ceil(count / itemsPerPage),
            publications: rows,
        });
    } catch (err) {
        return res.status(500).send({ message: 'Request Error.' });
    }
}

async function getPublicationsUser(req, res) {
    const itemsPerPage = 10;
    const page = parseInt(req.params.page) || 1;
    const offset = (page - 1) * itemsPerPage;
    const userId = parseInt(req.params.user) || parseInt(req.user.sub);

    try {
        const { count, rows } = await Publication.findAndCountAll({
            where: { userId },
            limit: itemsPerPage,
            offset,
            order: [['createdAt', 'DESC']],
            include: [{ model: User, as: 'author' }],
        });

        return res.status(200).send({
            total: count,
            pages: Math.ceil(count / itemsPerPage),
            publications: rows,
        });
    } catch (err) {
        return res.status(500).send({ message: 'Request Error.' });
    }
}

async function getPublication(req, res) {
    const publicationId = parseInt(req.params.id);
    try {
        const publication = await Publication.findByPk(publicationId, {
            include: [{ model: User, as: 'author' }],
        });
        if (!publication) {
            return res.status(404).send({ message: 'Publication not found.' });
        }
        return res.status(200).send({ publication });
    } catch (err) {
        return res.status(500).send({ message: 'Request Error.' });
    }
}

async function deletePublication(req, res) {
    const publicationId = parseInt(req.params.id);
    const userId = parseInt(req.user.sub);
    try {
        const deleted = await Publication.destroy({ where: { id: publicationId, userId } });
        if (!deleted) {
            return res.status(404).send({ message: 'Publication not found.' });
        }
        return res.status(200).send({ message: 'Publication deleted.' });
    } catch (err) {
        return res.status(500).send({ message: 'Request Error.' });
    }
}

async function uploadImageMigrate(req, res) {
    const publicationId = parseInt(req.params.id);
    const userId = parseInt(req.user.sub);
    try {
        const buildObject = pify(upload.buildFile('./uploads/publications/', 'image'));
        await buildObject(req, res);

        if (!req.file) {
            return res.status(400).send({ message: 'Please upload a file!' });
        }

        const publicationFile = req.file.originalname;
        const updated = await Publication.update(
            { file: publicationFile },
            { where: { id: publicationId, userId } }
        );

        if (!updated[0]) {
            return res.status(404).send({ message: 'Publication Not Found.' });
        }

        const publication = await Publication.findByPk(publicationId);
        return res.status(200).send({ publication });
    } catch (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(500).send({ message: 'File size cannot be larger than 2MB!' });
        }
        return res.status(500).send({ message: `Could not upload the file. ${err}` });
    }
}

function getImageFile(req, res) {
    const image_file = req.params.imageFile;
    const path_file = './uploads/publications/' + image_file;
    fs.exists(path_file, (exists) => {
        if (exists) {
            res.sendFile(path.resolve(path_file));
        } else {
            return res.status(200).send({ message: 'Ups, the file not exists.' });
        }
    });
}

module.exports = {
    savePublication,
    getPublications,
    getPublicationsUser,
    getPublication,
    deletePublication,
    uploadImageMigrate,
    getImageFile,
};
