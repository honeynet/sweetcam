const { User } = require("../model/user");
const bcrypt = require("bcrypt");
const sequelize = require('../database/database');

const addUser = async (name, password) => {
    try {
        const saltRounds = 10
        await User.sync()
        const passwordHash = await bcrypt.hash(password, saltRounds)
        const result = await User.create({name: name, passwordHash: passwordHash})
        return {id: result.id, name: result.name}
    } catch (error) {
        console.error('Error adding user:', error);
        throw error;
    }
}

const findUserPasswordHashByName = async (name) => {
    try {
        // Remove unnecessary authenticate call - Sequelize manages connections
        await User.sync()
        const result = await User.findOne({where: {name: name}})
        return result === null ? null : result.passwordHash
    } catch (error) {
        console.error('Database connection error in findUserPasswordHashByName:', error);
        throw error;
    }
}

const findUserPasswordHashesByName = async (name) => {
    try {
        // Remove unnecessary authenticate call - Sequelize manages connections
        await User.sync()
        const results = await User.findAll({where: {name: name}})
        return results.map(result => result.passwordHash)
    } catch (error) {
        console.error('Database connection error in findUserPasswordHashesByName:', error);
        throw error;
    }
}

const validateUserPassword = async (username, password) => {
    try {
        const passwordHashes = await findUserPasswordHashesByName(username);
        if (!passwordHashes || passwordHashes.length === 0) {
            return false;
        }
        
        for (const hash of passwordHashes) {
            if (await bcrypt.compare(password, hash)) {
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Error validating user password:', error);
        throw error;
    }
}

const getNumberOfUsers = async () => {
    try {
        // Remove unnecessary authenticate call - Sequelize manages connections
        return await User.count()
    } catch (error) {
        console.error('Database connection error in getNumberOfUsers:', error);
        throw error;
    }
}

module.exports = { findUserPasswordHashByName, findUserPasswordHashesByName, validateUserPassword, addUser, getNumberOfUsers}