# [GAS]slackEmojiAnalytics
count custom reaction of Slack and put to Google spreadsheet

## Usage

1. Create new Spreadsheet and move to App Script's page.
2. Add to blank script file and paste this code.
3. Get a Slack User Token and paste to this file.
4. Deploy this code.

## Caution

* This code uses below Slack API.
  * [conversations.list](https://api.slack.com/methods/conversations.list)
  * [conversations.history](https://api.slack.com/methods/conversations.history)
  * [emoji.list](https://api.slack.com/methods/emoji.list)
* Please allow the following permissions for the Slack User Token to be acquired.
  * channels:history
  * groups:history
  * im:history
  * mpim:history
  * emoji:read
* The default range of history's date is 2021/04/01 to 2022/03/31.
