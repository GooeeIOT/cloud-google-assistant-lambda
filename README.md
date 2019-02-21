# Gooee Google Assistant
A Google Assistant integration that uses Gooee's API for lighting control.

## Requirements
* NodeJS 8.10 or higher
* AWS account
* Google Cloud Account
* OAuth2 client ID and secret obtained by emailing cloud-backend@gooee.com. You will need new OAuth2 credentials even if you obtained OAuth credentials for Gooee Alexa.

### Dev Requirements
This is meant to be ran in an AWS Lambda environment, but to run tests locally: 
* `npm install`
* `npm test tests`

## Usage
Below are steps to deploy this Lambda function as a Gooee Smart Home Skill:

1. Create a Nodejs 8.10 AWS Lambda function "from scratch" using your AWS account in the region you plan to distribute the Google Assistant action.
2. In the Designer section, select "API Gateway" as a trigger. 
3. A new section "Configure triggers" should prompt you to provide pick an existing API or create a new one. If you are a Gooee User scroll through the dropdown 
    and select **google-assistant-lambda**. 
    * If you are a Non-Gooee User:
        1. Go to https://console.aws.amazon.com/apigateway/home
        2. Click the "Create API" button
        3. Make sure REST is selected in the **Protocol** section and fill in the additional settings -- API Name (Required),               Description (optional), Endpoint (should be Regional)
        4. Create your API Gateway
        5. Click on "Create Resource" from the Actions button, and give the resource a name (we used "fulfillment").
        6. On the next page, create a POST method from the **Actions** dropdown
        7. Fill in the integration info for the Lambda function to be accessible.
        8. Click on POST under the **Resources** section, then select the "Integration Request" box. Scroll down to "Mapping Templates" and in the **Request body passthrough** section select "When there are no templates defined (recommended)" if not selected. In the **Content Type** section click the "add mapping template" link. In the input section write "application/json"(no quotes) and click the check mark. After select "application/json" from the **Content-Type** list and select "Method Request Passthrough" from the "Generate template" dropdown or copy/paste the following in the code box and click Save:
        ```
        #set($allParams = $input.params())
        {
        "body-json" : $input.json('$'),
        "params" : {
        #foreach($type in $allParams.keySet())
            #set($params = $allParams.get($type))
        "$type" : {
            #foreach($paramName in $params.keySet())
            "$paramName" : "$util.escapeJavaScript($params.get($paramName))"
                #if($foreach.hasNext),#end
            #end
        }
            #if($foreach.hasNext),#end
        #end
        }
        }
        ```
        9. Select "Deploy API" from the Actions dropdown.
        10. After that it opens up the Deploy API dialog. If there's no Deployment Stage (or you want to create a new deployment stage) select Deployment Stage as the default “[New Stage]” and update the Stage name as you see fit. You can leave the other fields as blanks.
        11. Save the API URL for the upcoming steps.
        12. Back in your Lambda Function you should now be able to select your newly created API Gateway as a Trigger.
4. **In a new tab** log in to https://console.actions.google.com and select the "Add/import project" card.
5. Enter a name for your project and click "CREATE PROJECT" button.
6. When your project has loaded, on the next screen select the "Home control" card and then select the "Smart home" card on the next page.
7. Follow the steps in the Overview section:
    * Name your Smart Home action
    * Setup account linking:
        1. Select "No, I only want to allow account creation on my website".
        2. Select "OAuth" linking type and "Authorization code" grant type.
        3. Use the clientID and clientSecret from requirements section, and setup linking account
        4. Save.
    * Build Action should provide you a field to add fulfillment URL. Go back to your lambda function and select the API Gateway trigger. A new section
        should show the API Gateway along with the API endpoint. Copy that endpoint and paste it as the fulfillment URL in the
        Google actions console. Save.
8. If you do not already have an S3 bucket for the google-assistant app, create one.
9. In your terminal, in the directory your code is in run commands:
    * `npm install --package-lock`
    * `zip -r ../<NAME_OF_FILE>.zip *`
    * `aws s3 cp ../<NAME_OF_FILE>.zip s3://<BUCKET_NAME> --profile default`
    * `aws lambda update-function-code --function-name <LAMBDA_FUNC_NAME> --s3-bucket <BUCKET_NAME> --s3-key <NAME_OF_FILE>.zip --publish --profile default`
    * Go back to your AWS Lambda function and in the code section and select "Upload a file from Amazon S3" from the "Code entry type" drop-down. Provide the S3 URL as the upload (this can be found in the **Object URL** section of the bucket object -- make sure you're selecting the object last modified).
    * Alternatively, you can go to the Lambda console and upload the Zip file from your local system instead of S3.
10. In the "Handler" type in `lambda_function.fulfillment` or if you've changed the function name it's the module-name.export value in your function. Save.
