module.exports = {
  apps: [
    {
      name: 'HumTung',
      script: './server.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        PROJECT_NAME: 'HumTung',
        OWNER_EMAIL: 'nananashop19911@gmail.com'
      }
    }
  ]
};
