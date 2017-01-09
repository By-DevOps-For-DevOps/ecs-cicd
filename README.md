# IAC for Creating CI/CD pipeline with AWS developer tools using CloudFormation.

# Steps to install.
1. Compress the contents of `Lambda` folder and store to s3 bucket.
2. Save the s3 bucket name and path of the compressed file as key.
3. Make sure you have `buildspec.yaml` and `/ecs/service.yaml` in your application git repo. Similar to https://github.com/microservices-today/nginx-docker .
4. Customize the `parameter.json` file according to requirements.
5. Export the AWS access and secret key with default region in the console.
6. Run ```create-stack --stack-name myteststack --template-body file://///Users/user/Dropbox/microservices-today/Iac-ngp-cicd-aws/pipeline.yaml --parameters file:////Users/user/Dropbox/microservices-today/Iac-ngp-cicd-aws/parameters.json --capabilities CAPABILITY_NAMED_IAM```
