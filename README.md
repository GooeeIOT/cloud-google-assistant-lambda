# Gooee Google Assistant
A Google Assistant integration that uses Gooee's API for lighting control.

## Requirements
* NodeJS 12.X
* AWS account
* Google Cloud Account
* OAuth2 client ID and secret obtained by emailing cloud-backend@gooee.com. You will need new OAuth2 credentials even if you obtained OAuth credentials for Gooee Alexa.

### Dev Requirements
This is meant to be ran in an AWS Lambda environment, but to run tests locally: 
* `npm install`
* `npm test tests`

## Usage
Below are steps to deploy this Lambda function as a Gooee Smart Home Skill:

1. Create a Nodejs 12 AWS Lambda function "from scratch" using your AWS account in the region you plan to distribute the Google Assistant action. You will need an execution role for this lambda -- you can create one or use an already existing one. Your Lambda Execution Role should have the following policies: AWSLambdaRole, AWSLambdaBasicExecutionRole, and CloudWatchLogsReadOnlyAccess.
2. In the Designer section, select "API Gateway" as a trigger. 
3. A new section "Configure triggers" should prompt you to provide pick an existing API or create a new one. 

    * If you are a Gooee User scroll through the dropdown and select **google-assistant-lambda**. 
    * If you are a Non-Gooee User:
        1. Go to https://console.aws.amazon.com/apigateway/home
        2. Click the "Create API" button
        3. Make sure REST is selected in the **Protocol** section and fill in the additional settings -- API Name (Required),               Description (optional), Endpoint (should be Regional)
        4. Create your API Gateway
        5. Click on "Create Resource" from the Actions button, and give the resource a name (we used "fulfillment").
        6. Selecting the newly created resource, create a POST method from the **Actions** dropdown
        7. Fill in the integration info for the Lambda function to be accessible -- be sure to check the Lambda Proxy integration.
        8. Select "Deploy API" from the Actions dropdown.
        9. After that it opens up the Deploy API dialog. If there's no Deployment Stage (or you want to create a new deployment stage) select Deployment Stage as the default “[New Stage]” and update the Stage name as you see fit. You can leave the other fields as blanks.
        10. Save the API URL for the upcoming steps.
        11. Back in your Lambda Function you should now be able to select your newly created API Gateway as a Trigger.
4. Back in your AWS Lambda function, scroll down to the environment variables section. Here you should add two variables: **API_URL** and **LOG_LEVEL**. Set **API_URL** to *api.gooee.io* and **LOG_LEVEL** to one of (debug, info, warn, error).
5. **In a new tab** log in to https://console.actions.google.com and select the "Add/import project" card.
6. Enter a name for your project and click "CREATE PROJECT" button.
7. When your project has loaded, on the next screen select the "Home control" card and then select the "Smart home" card on the next page.
8. Follow the steps in the Overview section:
    * Name your Smart Home action
    * Setup account linking:
        1. Select "No, I only want to allow account creation on my website".
        2. Select "OAuth" linking type and "Authorization code" grant type.
        3. Use the clientID and clientSecret from requirements section **if you do not have these setup yet, contact cloud-backend@gooee.com with the name of your application and redirect uri**
            - For Google Assistant *Redirect URI* is https://oauth-redirect.googleusercontent.com/r/YOUR_PROJECT_ID, **YOUR_PROJECT_ID** can be found in the Actions on Google Settings page (click the cog wheel).
        4. The **Authorization URL** is https://api.gooee.io/auth/o/authorize
        5. The **Token URL** is https://api.gooee.io/auth/o/token/
        6. In the **Configure Your Client** section add these scopes (separately)
            - device:read
            - space:read
            - action:write
            - user:read
        5. Save.
    * Build Action should provide you with a field to add fulfillment URL. Go back to your lambda function and select the API Gateway trigger. A new section
        should show the API Gateway along with the API endpoint. Copy that endpoint and paste it as the fulfillment URL in the
        Google actions console. Save.
9. If you do not already have an S3 bucket for the google-assistant app, create one.
10. In your terminal, in the directory your code is in run commands:
    * `npm install --package-lock`
    * `zip -r ../<NAME_OF_FILE>.zip *`
    * `aws s3 cp ../<NAME_OF_FILE>.zip s3://<BUCKET_NAME> --profile default`
    * `aws lambda update-function-code --function-name <LAMBDA_FUNC_NAME> --s3-bucket <BUCKET_NAME> --s3-key <NAME_OF_FILE>.zip --publish --profile default`
    * Alternatively, after copying your zip file to s3 you can go back to your AWS Lambda function and in the code section select "Upload a file from Amazon S3" from the "Code entry type" drop-down. Provide the S3 URL as the upload (this can be found in the **Object URL** section of the bucket object -- make sure you're selecting the object last modified). Or you can go to the Lambda console and upload the Zip file from your local system instead of S3.
11. In the "Handler" type in `lambda_function.fulfillment` or if you've changed the function name it's the module-name.export value in your function. Save.
12. You can test this action via the Home section in the Google Assistant app on your phone after you hit "TEST" in the Build Action section of the Actions on Google console.

### Configuring for Request Sync
Request Sync triggers a SYNC request to your fulfillment for any Google user with devices that have the specified agentUserId associated with them -- their agentUserId will match their Gooee Customer ID. Request Sync allows you to update users' devices without unlinking and relinking their account.

Instructions for enabling Request Sync can be found [here](https://developers.google.com/actions/smarthome/develop/request-sync). It is suggested that you restrict your API Key for security reasons. Once you have generated your Google HomeGraph API Key, link this key to your Gooee Partner (i.e. `PATCH /partner/<id> {'google_homegraph_api_key: <API_KEY>'}`). To enable Request Sync for your customers create/update new or existing users with `{'is_homegraph_user': true}`.

### Configuring for Report State
Report State is an important feature which lets the smart home Action proactively report the latest status of the user’s device back to Google’s HomeGraph rather than waiting for a QUERY intent. Instructions for enabling Report State can be found [here](https://developers.google.com/actions/smarthome/develop/report-state). Once you have created you service account key, copy/paste this key into the **smart-home-key.json** file. Follow step #9 to update your lambda function with the service account key.

## Updating your Lambda
Below are the steps to follow whenever your lambda needs an update.

1. `git checkout master` branch.
2. `git pull` any new changes.
3. `npm install --package-lock`
4. `zip -r ../<NAME_OF_FILE>.zip *`
5. `aws s3 cp ../<NAME_OF_FILE>.zip s3://<BUCKET_NAME> --profile default`
6. `aws lambda update-function-code --function-name <LAMBDA_FUNC_NAME> --s3-bucket <BUCKET_NAME> --s3-key <NAME_OF_FILE>.zip --publish --profile default`
 
 Alternatively, after copying your zip file to s3 you can go back to your AWS Lambda function and in the code section select "Upload a file from Amazon S3" from the "Code entry type" drop-down. Provide the S3 URL as the upload (this can be found in the **Object URL** section of the bucket object -- make sure you're selecting the object last modified). Or you can go to the Lambda console and upload the Zip file from your local system instead of S3.
