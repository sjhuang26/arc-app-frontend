set -x

# dir check
current_d=${PWD##*/}

if [[ "$current_d" != 'arc-app-frontend' ]]
then
    echo 'WRONG DIRECTORY!'
    exit 1
fi

# delete
if [[ -d 'dist' ]]; then rm -r ./dist || exit 1; fi

# build (NOTE: without sourcemaps)
yarn run parcel-build-nomap || exit 1

# copy files from ./dist to ./arc-app-frontend-server/dist (which is a nested git repository)
cp ./dist/src.*.js ./arc-app-frontend-server/dist/index.js || exit 1
cp ./dist/src.*.css ./arc-app-frontend-server/dist/index.css || exit 1

# now we are in the subdirectory!
cd arc-app-frontend-server || exit 1

# push to git
# git add -A || exit 1
# git commit -m "commit" || exit 1
# git push || exit 1

# append a footer containing the date, which is useful for debug
# this will mess up sourcemaps, but sourcemaps aren't being deployed
{ printf '\n\n\n'; echo '/* Automatically built on '"$(date +"%Y-%m-%d %T")"' */'; printf '\n'; } >> dist/index.js

# deploy to netlify
netlify deploy -d dist --prod --message 'automatic' || exit 1

cd ..

# all done!
echo "ALL DONE!"
echo "JS LINK = https://arc-app-frontend-server.netlify.com/index.js"
echo "CSS LINK = https://arc-app-frontend-server.netlify.com/index.css"
