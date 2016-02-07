#!/bin/bash

# Set script name variable
SCRIPT=`basename ${BASH_SOURCE[0]}`
# Get script's location path
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
pushd $DIR
# move to the main folder
cd ..

docker run --rm --dns 8.8.8.8 --dns 8.8.4.4 -v $(pwd):/app mklimuk/jekyll sh -c "gulp $1"

popd
