setx REACT_APP_PRODUCTION_BUILD=true
setx REACT_APP_DIRECTORY_HOST=alpha.db.faims.edu.au
setx REACT_APP_COMMIT_VERSION=rini-windows

git clean -xfd 
npm ci 
npx cap copy android
npx cap update android
npx cap open android
