#!/bin/bash

# Set script name variable
SCRIPT=`basename ${BASH_SOURCE[0]}`
# Get script's location path
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
pushd $DIR
# move to the main folder
cd ..

docker-compose -p msite -f docker/compose.yml stop
docker-compose -p msite -f docker/compose.yml rm -v --force
docker-compose -p msite -f docker/compose.yml build
docker-compose -p msite -f docker/compose.yml up -d

popd
