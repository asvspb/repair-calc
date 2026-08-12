# DevOps / Deployment Rules

1. **Docker Multi-Stage Build:** This project uses multi-stage Docker builds for the frontend and backend.
2. **Never deploy via local npm run build:** Running `npm run build` locally will only place files in the local `dist/` folder, which is NOT mounted into the Nginx container. The Nginx container compiles and bakes its own `dist/` directory at build time.
3. **Use the deploy script:** Always use `./scripts/deploy-local.sh` to deploy changes locally. It includes safety checks, runs linters/tests, and correctly triggers the Docker rebuild.
4. **Manual Rebuilds:** If you must restart/rebuild manually without the script, always use `docker compose up -d --build frontend` (or `--build` for the specific service) to force Docker to invalidate the cache and rebuild the internal `dist/` directory.
