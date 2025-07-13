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
        // Test database connection first
        await sequelize.authenticate();
        await User.sync()
        const result = await User.findOne({where: {name: name}})
        return result === null ? null : result.passwordHash
    } catch (error) {
        console.error('Database connection error in findUserPasswordHashByName:', error);
        throw error;
    }
}

const getNumberOfUsers = async () => {
    try {
        await sequelize.authenticate();
        return await User.count()
    } catch (error) {
        console.error('Database connection error in getNumberOfUsers:', error);
        throw error;
    }
}

module.exports = { findUserPasswordHashByName, addUser, getNumberOfUsers}