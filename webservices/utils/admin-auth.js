const { Admin } = require('../model/admin');

// Middleware to check if the current user is an admin
async function requireAdminAuth(req, res, next) {
    try {
        // Check if user is logged in
        if (!req.session || !req.session.username) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const username = req.session.username;
        
        // Check if the user exists in the admin table
        const admin = await Admin.findOne({ where: { name: username } });
        
        if (!admin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // User is authenticated as admin
        req.adminUser = admin;
        next();
    } catch (error) {
        console.error('Admin authentication error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
}

module.exports = { requireAdminAuth }; 