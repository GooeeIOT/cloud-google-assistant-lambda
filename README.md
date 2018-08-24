# Gooee Google Assistant
A Google Assistant integration that uses Gooee's API for lighting control.

## Requirements
* NodeJS 8.10 or higher
* AWS account
* Google Cloud Account
* OAuth2 client ID and secret obtained by emailing cloud-backend@gooee.com

### Dev Requirements
This is meant to be ran in an AWS Lambda environment, but to run tests locally: 
* `npm install`
* `npm test`

## Usage
Below are steps to deploy this Lambda function as a Gooee Smart Home Skill:

1. Create a Nodejs 8.10 AWS Lambda function "from scratch" using your AWS account in the region you plan to distribute the Google Assistant action.
2. In the Designer section, select "API Gateway" as a trigger. 
3. A new section "Configure triggers" should prompt you to provide pick an existing API or create a new one. Scroll through the dropdown 
    and select **google-assistant-lambda**. 
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
        should show the API Gateway **google-assistant-lambda** along with the API endpoint. Copy that endpoint and paste it as the fulfillment URL in the
        Google actions console. Save.
8. In your terminal, in the directory your code is in run command: `zip -r ../<NAME_OF_YOUR_ZIP_FILE>.zip *`
9. Go back to your AWS Lambda function and in the code section and select "Upload a .ZIP file" from the "Code entry type" drop-down. Provide the zip file
    as the upload, then Save.
