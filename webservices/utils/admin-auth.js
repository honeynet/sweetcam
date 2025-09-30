const sequelize = require('../database/database');

// Middleware to check if the current user is an admin
async function requireAdminAuth(req, res, next) {
    try {
        // Check if user is logged in
        if (!req.session || !req.session.username) {
            console.log('Admin auth failed: No session or username');
            return res.status(401).json({ error: 'Authentication required' });
        }

        const username = req.session.username;
        console.log('Admin auth check for user:', username);
        
        // First check if session is marked as admin (for admin login)
        if (req.session.isAdmin) {
            console.log('User authenticated as admin via session flag');
            // User is authenticated as admin via admin login
            req.adminUser = { name: username };
            return next();
        }
        
        // Fallback: Check if the user exists in the admin table
        try {
            const results = await sequelize.query(
                'SELECT * FROM admins WHERE name = ?',
                {
                    replacements: [username],
                    type: sequelize.QueryTypes.SELECT
                }
            );
            
            if (results.length === 0) {
                console.log('Admin auth failed: User not found in admin table');
                return res.status(403).json({ error: 'Admin access required' });
            }

            console.log('User authenticated as admin via admin table');
            // User is authenticated as admin
            req.adminUser = results[0];
            next();
        } catch (dbError) {
            console.error('Database error in admin auth:', dbError);
            return res.status(500).json({ error: 'Database error during authentication' });
        }
    } catch (error) {
        console.error('Admin authentication error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
}

module.exports = { requireAdminAuth }; 