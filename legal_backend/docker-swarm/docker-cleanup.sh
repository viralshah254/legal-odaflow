#!/bin/sh

# A smarter Docker cleanup script that preserves recent images for rollbacks.

# --- Configuration ---
# The name of the image you want to clean up.
IMAGE_NAME="ayienda/legal-byodaflow"
# The number of recent images to keep.
IMAGES_TO_KEEP=3
# --- End Configuration ---

echo "Starting smart Docker cleanup for '$IMAGE_NAME' at $(date)"
echo "Keeping the $IMAGES_TO_KEEP most recent images."

# Get a list of all image IDs for the specified repository, sorted by creation date (newest first).
# Then, skip the first N images (the ones we want to keep) and get the IDs of the rest.
IMAGE_IDS_TO_DELETE=$(docker images --filter="reference=$IMAGE_NAME" --format "{{.ID}}" | tail -n +$(($IMAGES_TO_KEEP + 1)))

if [ -z "$IMAGE_IDS_TO_DELETE" ]; then
  echo "No old images found to delete for '$IMAGE_NAME'."
else
  echo "The following image IDs will be deleted:"
  echo "$IMAGE_IDS_TO_DELETE"
  # Use xargs to pass the list of image IDs to docker rmi.
  # The -r flag for xargs handles cases where the list is empty.
  echo "$IMAGE_IDS_TO_DELETE" | xargs -r docker rmi
  echo "Successfully deleted old images."
fi

echo "---"
echo "Running standard Docker system prune to clean up other unused resources..."
# Prune stopped containers, dangling images, unused networks, and volumes.
# The --volumes flag is optional but recommended if you don't need to preserve unused volume data.
docker system prune -f --volumes
echo "Standard prune complete."
echo "---"
echo "Docker cleanup finished at $(date)"
