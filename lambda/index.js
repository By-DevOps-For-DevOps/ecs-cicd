'use strict';
//Configuring AWS
var AWS = require('aws-sdk');
var YAML = require('yamljs');
exports.handler = (event, context, callback) => {
    console.log("Starting Lambda Execution with Event Handler");
    //Configuring AWS
    var AWS = require('aws-sdk');

    var fs = require('fs');
    var codepipeline = new AWS.CodePipeline();
    //Child process
    const exec = require('child_process').exec;
    //expecting params from input artifacts
    var params = {
        Bucket: event['CodePipeline.job'].data.inputArtifacts[0].location.s3Location.bucketName,
        Key: event['CodePipeline.job'].data.inputArtifacts[0].location.s3Location.objectKey
    };
    //Getting pipeline ID
    console.log(params);
    var jobId = event["CodePipeline.job"].id;
    var s3 = new AWS.S3({
        maxRetries: 10,
        signatureVersion: "v4"
    });
    AWS.config.update({region: 'ap-southeast-1'});
    var ecs = new AWS.ECS();
    const unzipCommand = "rm -rf /tmp/artifacts && mkdir -p /tmp/artifacts && unzip /tmp/artifact.zip -d /tmp/artifacts"
    // Notify AWS CodePipeline of a successful job
    var putJobSuccess = function(message) {
        console.log("Success" + message);
        var params = {
            jobId: jobId
        };
        AWS.config.update({region: 'us-east-1'});
        codepipeline.putJobSuccessResult(params, function(err, data) {
            if(err) {
                console.log("Unable to update pipeline" + err);
                context.fail(err);
            } else {
                context.succeed(message);
            }
        });
    };

    // Notify AWS CodePipeline of a failed job
    var putJobFailure = function(message) {
        console.log("Failure" + message);
        var params = {
            jobId: jobId,
            failureDetails: {
                message: JSON.stringify(message),
                type: 'JobFailed',
                externalExecutionId: context.invokeid
            }
        };
        AWS.config.update({region: 'us-east-1'});
        codepipeline.putJobFailureResult(params, function(err, data) {
            context.fail(message);
        });
    };
    //We can start with pulling the artifacts
    s3.getObject(params, function(err, data) {
    if (err) putJobFailure(err);
    else {
        //writing the artifacts to the /tmp/ , we have access to only this directory
        console.log("Writing the Zip File");
        fs.writeFile("/tmp/artifact.zip", data.Body, function(err) {
            if (err) putJobFailure(err);
            else {
                console.log("Executing the Unzip command");
                const child = exec(unzipCommand, (error) => {
                    if (error) putJobFailure(error);
                    else {
                      var serviceDefinition = YAML.load('/tmp/artifacts/ecs/service.yaml');
                      console.log(JSON.stringify(serviceDefinition));
                      console.log(JSON.stringify(serviceDefinition.Resources));
                      AWS.config.update({region: 'ap-southeast-1'});
                      var cloudformation = new AWS.CloudFormation();
                      var stackName = serviceDefinition.Parameters.ECSClusterName.Default + '-' + serviceDefinition.Resources.TaskDefinition.Properties.Family;
                      var params = {
                        StackName: stackName.replace(/['"]+/g, ''), /* required */
                        TemplateBody: JSON.stringify(serviceDefinition),
                      }
                      cloudformation.createStack(params, function (err, data) {
                        if (err)  {
                            cloudformation.updateStack(params, function(err, data) {
                               if (err) putJobFailure(err);// an error occurred
                               else     putJobSuccess(data);          // successful response
                              
                             });
                        } else putJobSuccess(data);
                      });
                    }
                });
                //print the output of child process
                child.stdout.on('data', console.log);
                child.stderr.on('data', console.error);
                callback(null, 'Process complete!');
            }
        });
        }

    });
};
