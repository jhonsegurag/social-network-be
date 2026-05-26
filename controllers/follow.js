'use strict';

const User = require('../models/user');
const Follow = require('../models/follow');

async function saveFollow(req, res) {
    const params = req.body;
    if (!params.followed) {
        return res.status(200).send({ message: 'Invalid Data.' });
    }
    const userId = parseInt(req.user.sub);
    const followedId = parseInt(params.followed);
    if (userId === followedId) {
        return res.status(200).send({ message: 'You cannot follow yourself.' });
    }
    try {
        const follow = await Follow.create({ userId, followedId });
        return res.status(200).send({ follow });
    } catch (err) {
        return res.status(500).send({ message: 'Request Error.' });
    }
}

async function deleteFollow(req, res) {
    const followId = parseInt(req.params.id);
    try {
        const follow = await Follow.findByPk(followId);
        if (!follow) {
            return res.status(404).send({ message: 'Follow Not Found.' });
        }
        if (parseInt(follow.userId) !== parseInt(req.user.sub)) {
            return res.status(500).send({ message: 'You do not have permissions to delete this follow.' });
        }
        await Follow.destroy({ where: { id: followId } });
        return res.status(200).send({ message: 'Follow deleted.' });
    } catch (err) {
        return res.status(500).send({ message: 'Request Error.' });
    }
}

async function getFollowingUsers(req, res) {
    let userId = req.user.sub;
    let page = 1;

    if (req.params.id && req.params.page) {
        userId = req.params.id;
        page = req.params.page;
    } else if (req.params.id) {
        page = req.params.id;
    }

    const itemsPerPage = 10;
    const offset = (parseInt(page) - 1) * itemsPerPage;

    try {
        const { count, rows } = await Follow.findAndCountAll({
            where: { userId: parseInt(userId) },
            limit: itemsPerPage,
            offset,
            include: [{ model: User, as: 'followedUser' }],
        });
        const value = await followUserIds(req.user.sub);
        return res.status(200).send({
            total: count,
            pages: Math.ceil(count / itemsPerPage),
            follows: rows,
            user_following: value.following,
            user_follow_me: value.followed,
        });
    } catch (err) {
        return res.status(500).send({ message: 'Request Error.' });
    }
}

async function getFollowedUser(req, res) {
    let userId = req.user.sub;
    let page = 1;

    if (req.params.id && req.params.page) {
        userId = req.params.id;
        page = req.params.page;
    } else if (req.params.id) {
        page = req.params.id;
    }

    const itemsPerPage = 10;
    const offset = (parseInt(page) - 1) * itemsPerPage;

    try {
        const { count, rows } = await Follow.findAndCountAll({
            where: { followedId: parseInt(userId) },
            limit: itemsPerPage,
            offset,
            include: [{ model: User, as: 'follower' }],
        });
        const value = await followUserIds(req.user.sub);
        return res.status(200).send({
            total: count,
            pages: Math.ceil(count / itemsPerPage),
            follows: rows,
            user_following: value.following,
            user_follow_me: value.followed,
        });
    } catch (err) {
        return res.status(500).send({ message: 'Request Error.' });
    }
}

async function getMyFollows(req, res) {
    const userId = parseInt(req.user.sub);
    try {
        let follows;
        if (req.params.followed) {
            follows = await Follow.findAll({
                where: { followedId: userId },
                include: [{ model: User, as: 'follower' }],
            });
        } else {
            follows = await Follow.findAll({
                where: { userId },
                include: [{ model: User, as: 'followedUser' }],
            });
        }
        return res.status(200).send({ follows });
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

module.exports = {
    saveFollow,
    deleteFollow,
    getFollowingUsers,
    getFollowedUser,
    getMyFollows,
};
