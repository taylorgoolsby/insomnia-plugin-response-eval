# Insomnia Response-Eval Template Tag

You can think of this as a combination of [`insomnia-plugin-response`](https://www.npmjs.com/package/insomnia-plugin-response) and [`insomnia-plugin-js-eval`](https://www.npmjs.com/package/insomnia-plugin-js-eval) but better.

## Installation
Install the `insomnia-plugin-response-eval` plugin from Preferences > Plugins.

## Usage
![example](example.png)
> Note code executed in async context so you can use `await` if you want
## You can access:
- responce - response on request
- body - decoded body
- etc... script executed in plugin function environment so you can use [this]([Title](https://docs.insomnia.rest/insomnia/context-object-reference)) as well
