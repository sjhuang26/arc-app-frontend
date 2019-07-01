set -x

# dir check
current_d=${PWD##*/}

if [ "$current_d" != "arc-app-frontend" ]
then
    echo "WRONG DIRECTORY!"
    exit 1
fi

# delete
if [ -d "dist" ]; then rm -ri ./dist || exit 1; fi

# build
yarn run parcel-build || exit 1

# copy files from ./dist to ./arc-app-frontend-server/dist (which is a nested git repository)
cp ./dist/src.*.js ./arc-app-frontend-server/dist/index.js || exit 1
cp ./dist/src.*.css ./arc-app-frontend-server/dist/index.css || exit 1

cd arc-app-frontend-server || exit 1

# push to git
# git add -A || exit 1
# git commit -m "commit" || exit 1
# git push || exit 1

# deploy to netlify
netlify deploy -d dist --prod --message "automatic" || exit 1

cd ..
