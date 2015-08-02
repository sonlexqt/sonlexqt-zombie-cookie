## What is `ts-zombie-cookie` ?

`ts-zombie-cookie` is a javascript library which helps storing persistent HTTP cookies, which is recreated after deletion from backups stored outside the web browser's dedicated cookie storage. It may be stored online or directly onto the visitor's computer, in a breach of browser security. This makes them very difficult to remove.  

`ts-zombie-cookie` based on the ideas of [zombie cookie](https://en.wikipedia.org/wiki/Zombie_cookie) and [evercookie](https://en.wikipedia.org/wiki/Evercookie).

## Cookies storage methods
Some methods used for storing cookies in the client browser includes:
  - Standard HTTP cookie
  - HTML5 session storage
  - HTML5 local storage
  - HTML5 Web SQL
  - HTML5 IndexedDB
  - window.name storage
  - // more are coming

## Installation
After cloning the project, navigate to the project root directory and run the following commands:
```sh
$ npm install
$ npm start # or nodemon bin/www (if you already have nodemon installed)
```
Open your browser and navigate to `http://localhost:3000/` to open the project demo page.

