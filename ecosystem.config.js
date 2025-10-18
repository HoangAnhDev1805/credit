module.exports = {
  apps: [
    {
      name: 'checkcc-backend',
      cwd: './backend',
      script: 'node',
      args: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: 8000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8000,
      },
    },
    {
      name: 'checkcc-frontend-dev',
      cwd: './frontend',
      // Use Next.js CLI directly via Node to avoid shell issues on Windows
      script: 'node',
      args: './node_modules/next/dist/bin/next dev -p 3000 -H 0.0.0.0',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'development',
        NEXT_PUBLIC_API_URL: 'http://localhost:8000',
      },
    },
    {
      name: 'checkcc-frontend',
      cwd: './frontend',
      script: 'node',
      args: './node_modules/next/dist/bin/next start -p 3000 -H 0.0.0.0',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};

