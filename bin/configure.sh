#!/usr/bin/env bash
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color


echo -e "\nPlease specify the preferred version of the application (Leave empty for the master version).
You can find the latest release version here.${GREEN}https://github.com/microservices-today/IaC-ngp-aws/releases.${NC}"
read VERSION
if [ "$VERSION" == "DEV" -o "$VERSION" == "dev" ]; then #skip for development
    echo -- Development mode --
else
    git checkout .
    if [[ -z "$VERSION" ]]; then
         git checkout master
       else
         git checkout tags/$VERSION
    fi
fi
echo -e "\nSpecify the bucket name for storing the lamda function, the bucket should be in same region of CodePipeline"
read S3_BUCKET_NAME
echo -e "Enter the AWS REGION to deploy the Cloudformation Stack"
read AWS_REGION

cd lambda
npm install
zip -r lambdafunction.zip ./*
aws s3 cp lambdafunction.zip s3://${S3_BUCKET_NAME}/
rm lambdafunction.zip
cp ../pipeline.yaml .
sed -i -e "s@S3_BUCKET_NAME@${S3_BUCKET_NAME}@g" pipeline.yaml
aws s3 cp pipeline.yaml s3://${S3_BUCKET_NAME}/
rm pipeline.yaml
rm pipeline.yaml-e

URL="https://console.aws.amazon.com/cloudformation/home?region=${AWS_REGION}#/stacks/new?templateURL=https://s3.amazonaws.com/${S3_BUCKET_NAME}/pipeline.yaml"
echo -e "Open the Link in Browser --- ${GREEN}${URL}${NC}"
if which xdg-open > /dev/null
then
  xdg-open $URL
elif which gnome-open > /dev/null
then
  gnome-open $URL
fi
