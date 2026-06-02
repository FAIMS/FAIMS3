# Utility script to reset the CouchDB database by removing the Docker
# volume that stores the database data. 
# Use with caution as this will delete all data in the CouchDB instance.

# Confirm that the user wants to clear the database
echo "This will clear the CouchDB database and cannot be undone."
read -p "Are you sure you want to continue? (y/N) " confirm
if [[ "$confirm" =~ ^[Yy]$ ]]; then

  docker compose down couchdb 2>/dev/null || true
  echo "Pruning volume containing the couchdb database..."
  volume_to_remove=$(docker volume ls -q --filter "label=com.docker.compose.volume=couchdb_data")
  if [ -n "$volume_to_remove" ]; then
    docker volume rm $volume_to_remove
    echo "Volume removed: $volume_to_remove"
  else
    echo "No volumes found for couchdb_data"
  fi
  docker compose up -d couchdb
else
  echo "Database clear cancelled."
fi