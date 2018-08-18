# CWClientHelperAppBot

**ChatWars Telegram helper bot**

This project demonstrates usage of [cw-rest-api](https://github.com/alevinru/CWClient#cwclient) NPM package.

## Install

```Shell
git clone git@github.com:alevinru/CWClientHelperAppBot.git

cd CWClientHelperAppBot

npm install
```

## Perquisites

Bot needs a connection to a [https://redis.io](Redis) database to store authorization data.
So you maybe need to build and run your own Redis instance.

By default bot connects to local Redis at default port. You could specify this behaviour with environment variables:
`REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`

## Setup

```Shell
CW_BOT_ID=ChatWars_Bot_ID
BOT_TOKEN=Your_Telegram_Bot_Token
```

Also you need to export ChatWars API credentials as described in
[alevinru/CWClient setup section](https://github.com/alevinru/CWClient#setup).


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
The bot parses the forward and requests `cwApi.sendGrantToken(userId, code)` to complete the authorization process.

### /profile

Does async request to `cwApi.requestProfile(userId, token)` then responds with raw json data.

### /stock

Does async request to `cwApi.requestStock(userId, token)` then responds with raw json data.

### /wtb itemCode quantity price

Alternate syntax is `/wtb_itemCode_quantity_price`

Moreover, any underscore in the command text may be replaced with space.

Command does `cwApi.wantToBuy(userId, { itemCode, quantity, price }, token)`

### Exception handling

Bot responds with process.env.PHRASE_NOT_IMPLEMENTED to any unknown message.



