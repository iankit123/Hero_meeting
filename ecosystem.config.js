{
  "apps": [
    {
      "name": "hero-meet-web",
      "script": "npm",
      "args": "start",
      "cwd": "/app",
      "instances": 1,
      "exec_mode": "fork",
      "env": {
        "NODE_ENV": "production"
      }
    },
    {
      "name": "hero-bot",
      "script": "npm",
      "args": "run bot",
      "cwd": "/app",
      "instances": 1,
      "exec_mode": "fork",
      "env": {
        "NODE_ENV": "production"
      },
      "restart_delay": 5000,
      "max_restarts": 10
    }
  ]
}
