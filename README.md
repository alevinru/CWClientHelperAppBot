# CWClientHelperAppBot

**ChatWars Telegram helper bot**

This project demonstrates usage of [cw-rest-api](https://github.com/alevinru/CWClient#cwclient) NPM package.

## Install

```Shell
git clone git@github.com:alevinru/CWClientHelperAppBot.git

cd CWClientHelperAppBot

npm install
```

## Setup

```Shell
CW_BOT_ID=ChatWars_Bot_ID
BOT_TOKEN=Your_Telegram_Bot_Token 
```

Also you need to export all the environment variables required by the
[alevinru/CWClient setup section](https://github.com/alevinru/CWClient#setup) ChatWars API including those, specified in the API [nodemon.json](https://github.com/alevinru/CWClient/blob/master/nodemon.json).

## Run

```Shell
npm run start
```

## Bot functionality

Commands and other chat hooks are exported from [src/middleware](src/middleware)

### /auth

Does async request to `cwApi.sendAuth(userId)` then responds with success or error message to the chat.

### Authorization confirmation

User should forward the entire message with confirmation code.
The bot parses the forward and requests cwApi.sendGrantToken(userId, code) to comlete the authorization process.

### /wtb itemCode quantity price

Alternate syntax is `/wtb_itemCode_quantity_price`

Moreover, any underscore in the command text may be replaced with space.

Command does `cwApi.wantToBy(userId, { itemCode, quantity, price })`


### Exception handling

Bot responds with process.env.PHRASE_NOT_IMPLEMENTED to any unknown message.



