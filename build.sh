npm cache clean --force
rm -rf node_modules package-lock.json dist .next
npm install
npm run build
npm rebuild better-sqlite3
npm run rebuild
npm run dist
