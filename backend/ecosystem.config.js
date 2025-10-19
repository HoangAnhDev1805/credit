module.exports = {
  apps: [
    {
      name: 'checkcc-backend',
      script: 'src/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      restart_delay: 5000, // 5s delay between restarts to avoid tight restart loops
      max_restarts: 5,
      min_uptime: 5000, // require at least 5s uptime to consider start successful
      max_memory_restart: '512M',
      error_file: '/home/checkcc/.pm2/logs/checkcc-backend-error.log',
      out_file: '/home/checkcc/.pm2/logs/checkcc-backend-out.log',
      combine_logs: true,
      env: {
        NODE_ENV: 'production'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      // Load environment variables from .env in the cwd
      env_file: '/home/checkcc/creditv2/backend/.env'
    }
  ]
};
