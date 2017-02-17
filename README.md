# IaC for Creating CodePipeline

### Prerequisites
1. Create an s3bucket in US region to store the lamda function.
2. Create an ECR repository in the region containing the ECS CLUSTER.
3. The application repository must contain `ecs/service.yaml` and `buildspec.yaml`.
4. GitHub Token with `admin:repo_hook` and `repo` scopes.

### Steps to install.
1. Update `lambda/config.json` file.
2. Run `bash bin/configure.sh`.
3. Open the link and at the end of the script to continue the installation.
4. Sample parameters can be seen in `parameters.json`

### Architecture
![Preview](CICDPipeline.png)

### CodePipeline Stages
##### Source Stage
AWS CodePipeline uses GitHub repository as the source stage for your code.

##### Build Stage
For Development and Staging CodePipeline, CodeBuild builds docker image from the 
source code and pushes it to ECR.
For production environment, CodeBuild pulls docker image from the
Staging ECR and pushes it to Production ECR.

Also, CodeBuild updates the CloudFormation template (service.yaml) to deploy the ECS
Service with environment specific information.

##### Deploy Stage
AWS Lambda creates/updates the CloudFormation stack to create/update the 
application Service in ECS.
