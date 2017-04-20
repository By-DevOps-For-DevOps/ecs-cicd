'use strict';
//Configuring AWS
var AWS = require('aws-sdk');
var YAML = require('yamljs');
var fs = require('fs');
var https = require('https');
var util = require('util');
var codepipeline = new AWS.CodePipeline();
const exec = require('child_process').exec;

exports.handler = function(event, context, callback) {

    console.log("Starting Lambda Execution with Event Handler");

    //expecting params from input artifactsv
    var s3Location = event['CodePipeline.job'].data.inputArtifacts[0].location.s3Location;
    var params = {
        Bucket: s3Location.bucketName,
        Key: s3Location.objectKey
    };

    //Getting pipeline ID
    console.log("Artifact Bucket Details: " + JSON.stringify(params));

    var jobId = event["CodePipeline.job"].id;
    var s3 = new AWS.S3({
        maxRetries: 10,
        signatureVersion: "v4"
    });

    const unzipCommand = "rm -rf /tmp/artifacts && mkdir -p /tmp/artifacts && unzip /tmp/artifact.zip -d /tmp/artifacts"

    AWS.config.update({region: process.env.ECSRegion});
    var cloudformation = new AWS.CloudFormation();

    // slack configurations
    var postData = {
        "channel": process.env.Channel,
        "username": process.env.DeployEnvironment.toUpperCase() +" :: " + process.env.EnvironmentName,
        "text": "**",
        "icon_emoji": ":cloud:"
    };

    var options = {
        method: 'POST',
        hostname: 'hooks.slack.com',
        port: 443,
        path: process.env.SlackWebHook
    };


    var sentSlackNotification = function (severity, title, message) {

        postData.text = "*"+ title + "*"
        postData.attachments = [
            {
                "color": severity,
                "text": message
            }
        ];

        var req = https.request(options, function(res) {
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                context.done(null);
            });
        });

        req.on('error', function(e) {
            console.log('problem with request: ' + e.message);
        });

        req.write(util.format("%j", postData));
        req.end();
    }


    /**
     * Function to Notify AWS CodePipeline
     * of a successful job
     */
    var putJobSuccess = function(message) {
        console.log("Success " + JSON.stringify(message));
        var params = {
            jobId: jobId
        };
        AWS.config.update({region: process.env.PipelineRegion});
        codepipeline.putJobSuccessResult(params, function(err, data) {
            if(err) {
                console.log("Unable to update pipeline" + err);
                context.fail(err);
            } else {
                context.succeed(message);
            }
        });
    };



    /**
     *  Function to Notify AWS CodePipeline
     *  of a failed job
     */
    var putJobFailure = function(message) {
        console.log("Failure " + JSON.stringify(message));
        var params = {
            jobId: jobId,
            failureDetails: {
                message: JSON.stringify(message),
                type: 'JobFailed',
                externalExecutionId: context.invokeid
            }
        };
        AWS.config.update({region: process.env.PipelineRegion});
        codepipeline.putJobFailureResult(params, function(err, data) {
            context.fail(message);
        });
    };



    /**
     * Function to update service definition
     */
    var updateServiceDefinition = function () {
        var serviceDefinition = YAML.load('/tmp/artifacts/ecs/service.yaml');
        console.log("service.yaml: " + JSON.stringify(serviceDefinition));

        var stackName = serviceDefinition.Resources.TaskDefinition.Properties.Family;
        var params = {
            StackName: stackName.replace(/['"]+/g, ''), /* required */
            TemplateBody: JSON.stringify(serviceDefinition),
            Capabilities: ['CAPABILITY_IAM'],
            NotificationARNs: [
                process.env.NotificationARN
            ]
        }

        console.log("Initiating service stack creation.");
        cloudformation.createStack(params, function (err, data) {
            if (err)  {
                console.log("Creation failed: "+JSON.stringify(err));
                if (err.code == "AlreadyExistsException") {
                    cloudformation.updateStack(params, function (err, data) {
                        if (err) {
                            if ( err.message == "No updates are to be performed.") {
                                putJobSuccess(data);
                                sentSlackNotification("good", "Deployment completed!", "No updates are to be performed.");
                            } else {
                                console.log("Updation failed: " + JSON.stringify(err));
                                putJobFailure(err);
                                sentSlackNotification("danger", "Deployment failed!", err.message);
                            }

                        } else {
                            console.log("Updation started successfully: " + JSON.stringify(data));
                            putJobSuccess(data);
                            sentSlackNotification("good", "Deployment started successfully!", "Deployment started successfully.");
                        }
                    });
                } else {
                    putJobFailure(err);
                    sentSlackNotification("danger", "Deployment failed!", err.message);
                }
            } else {
                console.log("Creation started successfully: "+JSON.stringify(data));
                putJobSuccess(data);
                sentSlackNotification("good", "Deployment started successfully!", "Deployment started successfully.");
            }
        });
    }



    //We can start with pulling the artifacts
    s3.getObject(params, function(err, data) {
        if (err) {
            putJobFailure(err);
        } else {
            //writing the artifacts to the /tmp/ , we have access to only this directory
            console.log("Writing the Zip File");

            fs.writeFile("/tmp/artifact.zip", data.Body, function(err) {
                if (err) {
                    putJobFailure(err);
                } else {
                    console.log("Executing the Unzip command");

                    const child = exec(unzipCommand, function (error) {
                        if (error) {
                            putJobFailure(error);
                        } else {
                            updateServiceDefinition();
                        }
                    });

                    callback(null, 'Process complete!');
                }
            });
            }

    });
};