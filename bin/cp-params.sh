#!/usr/bin/env bash
#
# Example:
# bash cp-params.sh ../ngp-nodejs/.env.sample v303-Staging v305-Staging
#

set -ex

usage() { 
  echo "Incorrect number of arguments"
  echo "Usage: bash $0 .env.sample old-env new-env"
}

if [[ ( $# == "--help") ||  $# == "-h" ]]
then
   usage
   exit 1
fi

if [ $# -ne 3 ]
then
  usage
  exit 1
fi

KEYS=`awk -F"=" '{print $1}' ${1}`
for KEY in $KEYS
do
  VALUE=`aws ssm get-parameters --name "${2}.${KEY}" --with-decryption --query Parameters[0].Value --output text`
  aws ssm put-parameter --name "/${3}/${KEY}" --value "${VALUE}" --type SecureString --overwrite
done
