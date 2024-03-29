#!/usr/bin/env bash

set -euo pipefail

[[ -z "${DEBUG:-}" ]] || set -x

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "\nSpecify the ${GREEN}S3 bucket name${NC} for storing the lambda function, the bucket should be in same region of CodePipeline"
read -r S3_BUCKET_NAME

echo -e "Enter the ${GREEN}AWS REGION${NC} to deploy the Cloudformation Stack [default: ${BLUE}ap-southeast-1${NC}]"
read -r AWS_REGION
if [[ -z "$AWS_REGION" ]]; then
    AWS_REGION=ap-southeast-1
fi

cp pipeline.yaml bin/

# e.g. ngp-v305-app-stage, the reusable S3 bucket for app pipeline
sed -i -e "s@S3_BUCKET_NAME@${S3_BUCKET_NAME}@g" bin/pipeline.yaml
# e.g. ngp-v305-app-stage -> v305
TAG_NAME=$(echo "${S3_BUCKET_NAME}" | cut -d'-' -f2)
sed -i -e "s@INFRA_TAG_NAME@${TAG_NAME}@g" bin/pipeline.yaml

aws s3 cp bin/pipeline.yaml s3://${S3_BUCKET_NAME}/
rm bin/pipeline.yaml
rm -f bin/pipeline.yaml-e

URL="https://console.aws.amazon.com/cloudformation/home?region=${AWS_REGION}#/stacks/new?templateURL=https://s3.amazonaws.com/${S3_BUCKET_NAME}/pipeline.yaml"
echo -e "Open the Link in Browser:\n${GREEN}${URL}${NC}"
