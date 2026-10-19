// MongoDB Initialization Script
// Creates application user with least-privilege access

db = db.getSiblingDB('securevault');

db.createUser({
  user: 'sv_app',
  pwd:  'CHANGE_ME_APP_DB_PASSWORD',
  roles: [
    { role: 'readWrite', db: 'securevault' }
  ]
});

// Indexes for performance and security
db.users.createIndex({ email: 1 },    { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.files.createIndex({ owner: 1 });
db.files.createIndex({ sha256Hash: 1 });

print('✅ SecureVault MongoDB initialized.');
