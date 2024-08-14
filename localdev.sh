#!/bin/bash -e

wait_for_service() {
    local start_time
    local end_time
    local current_time
    local response

    start_time=$(date +%s)
    end_time=$((start_time + 30))

    while true; do
        current_time=$(date +%s)
        if [ $current_time -ge $end_time ]; then
            echo "Global timeout reached. Service did not become available within 30 seconds."
            return 1
        fi

        if response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://localhost:8080/auth); then
            if [ "$response" -eq 200 ]; then
                echo "Service is now available!"
                return 0
            fi
        fi

        echo "Service not yet available. Retrying in 2 seconds..."
        sleep 2
    done
}



echo "checking npm install"
echo "> npm --version"
npm --version

echo "checking docker install"
echo "> docker --version"
docker --version

echo "checking uuid install"
echo "> uuid"
uuid

# install dependencies
echo "Installing monorepo dependencies"
echo "> npm install"
npm install

# create .env files

echo "> cp ./api/.env.dist ./api/.env"
cp ./api/.env.dist ./api/.env

echo "> cp ./app/.env.dist ./app/.env"
cp ./app/.env.dist ./app/.env

# create local keys
echo "Generating local keys"
echo "> npm run generate-local-keys"
npm run generate-local-keys

echo "Building docker files using docker compose"
echo "> ./scripts/devbuild.sh"
./scripts/devbuild.sh

echo "Starting docker service..."
echo "> ./scripts/devup.sh"
./scripts/devup.sh

echo "Waiting for service to become available at http://localhost:8080..."

# Call the function and capture its return status
if wait_for_service; then
    echo "Continuing with the rest of the script..."
    # Add your additional commands here
else
    echo "Failed to connect to the service. Exiting."
    exit 1
fi

echo "Initialising database"
echo "> npm run initdb"
npm run initdb


# installing dependencies and building locally to test FAIMS3 app
echo "installing dependencies and building locally to test FAIMS3 app"
echo "> npm run build-data-model"
npm run build-data-model
echo "> cd app && npm i && cd ../"
cd app && npm i && cd ../

echo "Service is setup, to load notebooks follow the below steps"
cat << EOF
This script requires authentication, so you need to get a user token for the admin
user. First, connect to the conductor instance on http://localhost:8080/ or whatever
port you have configured. Login using the local 'admin' user and password.
Now, from the Conductor home page (http://localhost:8080/) scroll down to "Copy
Bearer Token to Clipboard". Paste this value into your .env file as the
value of USER_TOKEN.

Then run: 

$> npm run load-notebooks
EOF

echo "To run the FAIMS app locally with live reload, run npm run start-app"