#!/usr/bin/env bash
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
#avoid `ci-cd` from the module list.
modules=("ecs" "nginx" "tyk" )
VERSION=master
#Comment out the below line while development
#git checkout .
echo -e "\nPlease specify the preferred version of the application (Leave empty for the master version).
You can find the latest release version here.${GREEN}https://github.com/microservices-today/IaC-ngp-aws/releases.${NC}"
read VERSION
if [[ -z "$VERSION" ]]; then
    VERSION=master
    else
   git checkout tags/$VERSION
fi
echo -e "\nSpecify the bucket name for storing the lamda function, the bucket should be in same region of CodePipeline"
read S3_BUCKET_NAME
cd Lambda
npm install
zip -r lambdafunction.zip ./*
aws s3 cp lambdafunction.zip s3://${S3_BUCKET_NAME}/
cd ../
aws s3 cp pipeline.yaml s3://${S3_BUCKET_NAME}/
echo -e "Enter the AWS REGION to deploy the Cloudformation Stack"
read AWS_REGION
URL="https://console.aws.amazon.com/cloudformation/home?region=${AWS_REGION}#/stacks/new?templateURL=https://s3.amazonaws.com/${S3_BUCKET_NAME}/pipeline.yaml"
echo -e "Open the Link in Browser --- ${GREEN}${URL}${NC}"
if which xdg-open > /dev/null
then
  xdg-open $URL
elif which gnome-open > /dev/null
then
  gnome-open $URL
fi
