rm -rf node_modules/ dist/ .next/ package-lock.json
npm i
npm cache clean --force
npm run dev