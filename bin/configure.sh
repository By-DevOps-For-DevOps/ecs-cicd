#!/usr/bin/env bash
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color


echo -e "\nSpecify the ${GREEN}S3 bucket name${NC} for storing the lamda function, the bucket should be in same region of CodePipeline"
read S3_BUCKET_NAME
echo -e "Enter the ${GREEN}AWS REGION${NC} to deploy the Cloudformation Stack [default: ${BLUE}ap-northeast-1${NC}]"
read AWS_REGION
if [[ -z "$AWS_REGION" ]]; then
    AWS_REGION=ap-northeast-1
fi

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
cd ..
aws s3 cp notification.yaml s3://${S3_BUCKET_NAME}/
zip lambda_notify.zip lambda_notify.py
aws s3 cp lambda_notify.zip s3://${S3_BUCKET_NAME}/
rm lambda_notify.zip

URL="https://console.aws.amazon.com/cloudformation/home?region=${AWS_REGION}#/stacks/new?templateURL=https://s3.amazonaws.com/${S3_BUCKET_NAME}/pipeline.yaml"
echo -e "Open the Link in Browser --- ${GREEN}${URL}${NC}"
if which xdg-open > /dev/null
then
  xdg-open $URL
elif which gnome-open > /dev/null
then
  gnome-open $URL
fi
