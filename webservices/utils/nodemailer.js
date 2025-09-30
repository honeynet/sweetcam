const nodemailer = require('nodemailer');

const a = {
    service: process.env.EMAIL_SERVICE || 'gmail',
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    secure: true,
    port: 465,
    auth: {
        user: process.env.EMAIL_ADDRESS || 'default@example.com',
        pass: process.env.EMAIL_PASSWORD || 'default-password',
    },
}
console.log(a)
const transporter = nodemailer.createTransport(a)

module.exports = transporter

