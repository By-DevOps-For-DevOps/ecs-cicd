'use strict';
//Configuring AWS
var AWS = require('aws-sdk');
var YAML = require('yamljs');
var fs = require('fs');
var https = require('https');
var util = require('util');
var codepipeline = new AWS.CodePipeline();
const exec = require('child_process').exec;
var config = require("./config.json");

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

    AWS.config.update({region: config.ecs_cluster_region});
    var cloudformation = new AWS.CloudFormation();

    // slack configurations
    var postData = {
        "channel": config.slack_channel,
        "username": "AWS Codepipeline via Lamda :: DevQa Cloud",
        "text": "**",
        "icon_emoji": ":cubimal_chick:"
    };

    var options = {
        method: 'POST',
        hostname: 'hooks.slack.com',
        port: 443,
        path: config.slack_web_hook_url
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
        sentSlackNotification("good", "Deployment successful!", "Deployment has been successful.");
        var params = {
            jobId: jobId
        };
        AWS.config.update({region: config.codepipeline_region});
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
        sentSlackNotification("danger", "Deployment failed!", message.message);
        var params = {
            jobId: jobId,
            failureDetails: {
                message: JSON.stringify(message),
                type: 'JobFailed',
                externalExecutionId: context.invokeid
            }
        };
        AWS.config.update({region: config.codepipeline_region});
        codepipeline.putJobFailureResult(params, function(err, data) {
            context.fail(message);
        });
    };


    /**
     * Function to wait for stack creation completion
     * @param params
     */
    var waitForStackCreateComplete = function (params) {
        AWS.config.update({region: config.ecs_cluster_region});
        cloudformation.waitFor('stackCreateComplete', params, function(err, data) {
            if (err) {
                console.log(err, err.stack);
                putJobFailure(err);
            } else {
                console.log(data);
                putJobSuccess(data);
            }
        });
    }


    /**
     * Function to wait for stack updation completion
     * @param params
     */
    var waitForStackUpdateComplete = function (params) {
        AWS.config.update({region: config.ecs_cluster_region});
        cloudformation.waitFor('stackUpdateComplete', params, function(err, data) {
            if (err) {
                console.log(err, err.stack);
                putJobFailure(err);
            } else {
                console.log(data);
                putJobSuccess(data);
            }
        });
    }


    /**
     * Function to update service definition
     */
    var updateServiceDefinition = function () {
        var serviceDefinition = YAML.load('/tmp/artifacts/ecs/service.yaml');
        console.log("service.yaml: " + JSON.stringify(serviceDefinition));

        var stackName = serviceDefinition.Parameters.EnvironmentName.Default + '-' +
            serviceDefinition.Resources.TaskDefinition.Properties.Family;

        var params = {
            StackName: stackName.replace(/['"]+/g, ''), /* required */
            TemplateBody: JSON.stringify(serviceDefinition),
            Capabilities: ['CAPABILITY_IAM']
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
                            } else {
                                console.log("Updation failed: " + JSON.stringify(err));
                                putJobFailure(err);
                            }

                        } else {
                            console.log("Updation started successfully: " + JSON.stringify(data));
                            waitForStackUpdateComplete({StackName: data.StackId});
                        }
                    });
                } else {
                    putJobFailure(err);
                }
            } else {
                console.log("Creation started successfully: "+JSON.stringify(data));
                waitForStackCreateComplete({StackName: data.StackId});
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
