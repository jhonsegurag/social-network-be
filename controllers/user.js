'use strict';

const { Op } = require('sequelize');
const bcryptjs = require('bcryptjs');
const User = require('../models/user');
const Follow = require('../models/follow');
const Publication = require('../models/publication');
const jwt = require('../services/jwt');
const fs = require('fs');
const path = require('path');
const upload = require('../middlewares/upload');
const pify = require('pify');

async function saveUser(req, res) {
    const params = req.body;
    if (!params.name || !params.surname || !params.nick || !params.email || !params.password) {
        return res.status(200).send({ message: 'Invalid Data.' });
    }
    try {
        const existing = await User.findOne({
            where: {
                [Op.or]: [
                    { email: params.email.toLowerCase() },
                    { nick: params.nick.toLowerCase() },
                ],
            },
        });
        if (existing) {
            return res.status(200).send({ status_code: 200, message: 'User already exists.' });
        }
        const hash = await bcryptjs.hash(params.password, 10);
        const user = User.build({
            name: params.name,
            surname: params.surname,
            nick: params.nick,
            email: params.email,
            role: 'ROLE_USER',
            image: null,
            password: hash,
        });
        const userStored = await user.save();
        return res.status(200).send({ user: userStored });
    } catch (err) {
        return res.status(500).send({ message: 'Saving user error.' });
    }
}

async function loginUser(req, res) {
    const params = req.body;
    try {
        const user = await User.findOne({ where: { email: params.email } });
        if (!user) {
            return res.status(500).send({ message: 'Wrong email or password.' });
        }
        const check = await bcryptjs.compare(params.password, user.password);
        if (!check) {
            return res.status(500).send({ message: 'Wrong email or password.' });
        }
        if (params.gettoken) {
            return res.status(200).send({ token: jwt.createtoken(user) });
        }
        user.password = undefined;
        return res.status(200).send({ user });
    } catch (err) {
        return res.status(500).send({ message: 'Login error.' });
    }
}

async function getUser(req, res) {
    const userId = req.params.id;
    try {
        const user = await User.findByPk(userId);
        if (!user) return res.status(404).send({ message: 'User Not Found.' });
        const value = await followThisUser(req.user.sub, userId);
        return res.status(200).send({ user, following: value.following, followed: value.followed });
    } catch (err) {
        return res.status(500).send({ message: 'Request Error.' });
    }
}

async function followThisUser(identity_user_id, user_id) {
    const following = await Follow.findOne({ where: { userId: parseInt(identity_user_id), followedId: parseInt(user_id) } })
        .catch(() => null);
    const followed = await Follow.findOne({ where: { userId: parseInt(user_id), followedId: parseInt(identity_user_id) } })
        .catch(() => null);
    return { following, followed };
}

async function getUsers(req, res) {
    const identityUserId = req.user.sub;
    const itemsPerPage = 10;
    const page = parseInt(req.params.page) || 1;
    const offset = (page - 1) * itemsPerPage;
    try {
        const { count, rows } = await User.findAndCountAll({
            limit: itemsPerPage,
            offset,
            order: [['id', 'ASC']],
        });
        if (!rows || rows.length === 0) {
            return res.status(404).send({ message: 'Users Not Found.' });
        }
        const value = await followUserIds(identityUserId);
        return res.status(200).send({
            users: rows,
            user_following: value.following,
            user_follow_me: value.followed,
            total: count,
            pages: Math.ceil(count / itemsPerPage),
        });
    } catch (err) {
        return res.status(500).send({ message: 'Request Error.' });
    }
}

async function followUserIds(user_id) {
    const following = await Follow.findAll({ where: { userId: parseInt(user_id) } }).catch(() => []);
    const followed = await Follow.findAll({ where: { followedId: parseInt(user_id) } }).catch(() => []);
    return {
        following: following.map(f => f.followedId),
        followed: followed.map(f => f.userId),
    };
}

async function getCounters(req, res) {
    let userId = req.user.sub;
    if (req.params.id) userId = req.params.id;
    try {
        const value = await getCountFollow(userId);
        return res.status(200).send(value);
    } catch (err) {
        return res.status(500).send({ message: 'Request Error.' });
    }
}

async function getCountFollow(user_id) {
    const following = await Follow.count({ where: { userId: parseInt(user_id) } });
    const followed = await Follow.count({ where: { followedId: parseInt(user_id) } });
    const publications = await Publication.count({ where: { userId: parseInt(user_id) } });
    return { following, followed, publications };
}

async function updateUser(req, res) {
    const userId = req.params.id;
    const update = req.body;
    delete update.password;
    if (parseInt(userId) !== parseInt(req.user.sub)) {
        return res.status(500).send({ message: 'You do not have permissions to modify the user.' });
    }
    try {
        const existing = await User.findOne({
            where: {
                [Op.or]: [
                    { email: (update.email || '').toLowerCase() },
                    { nick: (update.nick || '').toLowerCase() },
                ],
            },
        });
        if (existing && existing.id !== parseInt(userId)) {
            return res.status(400).send({ message: 'The email and/or the nick already exists...' });
        }
        await User.update(update, { where: { id: userId } });
        const userUpdated = await User.findByPk(userId);
        if (!userUpdated) return res.status(404).send({ message: 'User Not Found.' });
        return res.status(200).send({ user: userUpdated });
    } catch (err) {
        return res.status(500).send({ message: 'Request Error.' });
    }
}

async function uploadImageMigrate(req, res) {
    const userId = req.params.id;
    try {
        const buildObject = pify(upload.buildFile('./uploads/users/', 'image'));
        await buildObject(req, res);
        if (!req.file) return res.status(400).send({ message: 'Please upload a file!' });
        const userFile = req.file.originalname;
        await User.update({ image: userFile }, { where: { id: userId } });
        const userUpdated = await User.findByPk(userId);
        if (!userUpdated) return res.status(404).send({ message: 'User Not Found.' });
        return res.status(200).send({ user: userUpdated });
    } catch (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(500).send({ message: 'File size cannot be larger than 2MB!' });
        }
        return res.status(500).send({ message: `Could not upload the file. ${err}` });
    }
}

function getImageFile(req, res) {
    const image_file = req.params.imageFile;
    const path_file = './uploads/users/' + image_file;
    fs.exists(path_file, (exists) => {
        if (exists) {
            res.sendFile(path.resolve(path_file));
        } else {
            return res.status(200).send({ message: 'Ups, the file not exists.' });
        }
    });
}

module.exports = {
    saveUser,
    loginUser,
    getUser,
    getUsers,
    getCounters,
    updateUser,
    uploadImageMigrate,
    getImageFile,
};
