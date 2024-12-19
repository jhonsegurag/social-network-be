'use strict';

var fs = require('fs');
var path = require('path');
var moment = require('moment');
var mongoosePaginate = require('mongoose-pagination');
var Publication = require('../models/publication');
var User = require('../models/user');
var Follow = require('../models/follow');
const { get } = require('../routes/default');
const upload = require("../middlewares/upload");
const pify = require('pify');

function savePublication(req, res) {
    var params = req.body;
    if (!params.text)
        return res.status(200).send({message: "Text field is required."});

    var publication = new Publication();
    publication.text = params.text;
    publication.file = 'null';
    publication.user = req.user.sub;
    publication.created_at = moment().unix();
    publication.save((err, publicationStored) => {
        if (err)
            return res.status(500).send({message: "Saving publication error."});
        if (!publicationStored)
            return res.status(404).send({message: "Publication not saved."});

        return res.status(200).send({publication: publicationStored});
    });
}

function getPublications(req, res) {
    var page = 1;
    var itemsPerPage = 10;
    if (req.params.page) {
        page = req.params.page;
    }
    Follow.find({user: req.user.sub}).populate('followed').exec((err, follows) => {
        if (err)
            return res.status(500).send({message: "Get publications error."});

        var follows_clean = [];
        follows.forEach((follow) => {
            follows_clean.push(follow.followed);
        });
        follows_clean.push(req.user.sub);
        Publication.find({user: {"$in": follows_clean}}).sort('-created_at').populate('user').paginate(page, itemsPerPage, (err, publications, total) => {
            if (err)
                return res.status(500).send({message: "Get publications error..."});
            if (!publications)
                return res.status(404).send({message: "Publications not found."});

            return res.status(200).send({
                total_items: total,
                pages: Math.ceil(total / itemsPerPage),
                page: page,
                item_per_page: itemsPerPage,
                publications
            });
        });
    });
}

function getPublicationsUser(req, res) {
    var itemsPerPage = 10;
    var page = 1;
    if (req.params.page) {
        page = req.params.page;
    }
    var user = req.user.sub;
    if (req.params.user) {
        user = req.params.user;
    }
    Publication.find({user: user}).sort('-created_at').populate('user').paginate(page, itemsPerPage, (err, publications, total) => {
        if (err)
            return res.status(500).send({message: "Get publications error..."});
        if (!publications)
            return res.status(404).send({message: "Publications not found."});

        return res.status(200).send({
            total_items: total,
            pages: Math.ceil(total / itemsPerPage),
            page: page,
            item_per_page: itemsPerPage,
            publications
        });
    });
}

function getPublication(req, res) {
    var publicationId = req.params.id;
    Publication.findById(publicationId, (err, publication) => {
        if (err)
            return res.status(500).send({message: "Get publication error..."});
        if (!publication)
            return res.status(404).send({message: "Publication not found."});

        return res.status(200).send({publication});
    });
}

function deletePublication(req, res) {
    var publicationId = req.params.id;
    Publication.find({'user': req.user.sub, '_id': publicationId}).remove((err) => {
        if (err)
            return res.status(500).send({message: "Delete publication error..."});

        return res.status(200).send({message: 'Publication deleted.'});
    });
}

function uploadImage(req, res) {
    var publicationId = req.params.id;
   
    if (req.files) {
        console.log('mesage' + req.files);

        var file_path = req.files.image.path;
        console.log(file_path);

        var file_split = file_path.split('/');
        console.log(file_split);

        var file_name = file_split[2];
        console.log(file_name);
        
        var ext_split = file_name.split('\.');
        console.log(ext_split);

        var file_ext = ext_split[1];
        console.log(file_ext);

        if (file_ext === 'png' || file_ext === 'jpg' || file_ext === 'jpeg' || file_ext === 'gif') {
            Publication.findOne({'user': req.user.sub, '_id': publicationId}).exec((err, publication) => {
                if (publication) {
                    Publication.findByIdAndUpdate(publicationId, {file: file_name}, {new : true}, (err, publicationUpdated) => {
                        if (!publicationUpdated)
                            return res.status(404).send({message: "Publication Not Found."});
                        if (err)
                            return res.status(500).send({message: "Request Error."});

                        return res.status(200).send({publication: publicationUpdated});
                    });
                } else {
                    return removeFilesOfUploads(res, file_path, "You do not have permissions to modify this publication.");
                }
            });
        } else {
            return removeFilesOfUploads(res, file_path, "Ups, please upload a valid image file.");
        }
    } else {
        return res.status(200).send({message: "Ups, please upload any file."});
    }
}

async function uploadImageMigrate(req, res) {

    var publicationId = req.params.id;
    var publicationFile = '';

    try {

        let buildObject = pify(upload.buildFile("./uploads/publications/", "image"));
        await buildObject(req, res);
    
        if (req.file == undefined) {
          return res.status(400).send({ message: "Please upload a file!" });
        }

        publicationFile = req.file.originalname;

        Publication.findOne({'user': req.user.sub, '_id': publicationId}).exec((err, publication) => {
            if (publication) {
                Publication.findByIdAndUpdate(publicationId, {file: publicationFile}, {new : true}, (err, publicationUpdated) => {
                    if (!publicationUpdated)
                        return res.status(404).send({message: "Publication Not Found."});
                    if (err)
                        return res.status(500).send({message: "Request Error."});
    
                    return res.status(200).send({publication: publicationUpdated});
                });
            } else {
                return removeFilesOfUploads(res, file_path, "You do not have permissions to modify this publication.");
            }
        });
      } catch (err) {
        console.log(err);
    
        if (err.code == "LIMIT_FILE_SIZE") {
          return res.status(500).send({
            message: "File size cannot be larger than 2MB!",
          });
        }
    
        res.status(500).send({
          message: `Could not upload the file: ${req.file.originalname}. ${err}`,
        });
      }

    
}

function removeFilesOfUploads(res, file_path, message) {
    fs.unlink(file_path, (err) => {
        return res.status(200).send({message: message});
    });
}

function getImageFile(req, res) {
    var image_file = req.params.imageFile;
    var path_file = './uploads/publications/' + image_file;
    fs.exists(path_file, (exists) => {
        if (exists) {
            res.sendFile(path.resolve(path_file));
        } else {
            return res.status(200).send({message: "Ups, the file not exists."});
        }
    });
}

module.exports = {
    savePublication,
    getPublications,
    getPublication,
    deletePublication,
    uploadImage,
    uploadImageMigrate,
    getImageFile,
    getPublicationsUser
};
