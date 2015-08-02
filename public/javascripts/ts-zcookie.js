(function(){
    // define constants
    var ZOMBIE_COOKIE_NAME = "persistent-user-id"; //TODO change this name. Also, we will store a lot of info, not just this one
    var INFINITY_EXPIRING_DAY = "Fri, 31 Dec 9999 23:59:59 GMT";
    var DEFAULT_MAX_USERID = 1000;

    // define variables
    var setCookieBtn = document.getElementById("btn-set-cookie");
    var deleteCookieBtn = document.getElementById("btn-delete-cookie");
    var showCookieBtn = document.getElementById("btn-show-cookie");

    var LogService = function(){
        var _isDebug = true; // DEFAULT TO TRUE
        return {
            setDebug: function(booleanValue){
                _isDebug = booleanValue;
            },
            log: function(msg){
                if (_isDebug) console.log("> DEBUG: " + msg);
            },
            info: function(msg){
                if (!_isDebug) console.info("(i) INFO: " + msg);
            },
            warning: function(msg){
                if (!_isDebug) console.warn("/!\\ WARNING: " + msg);
            },
            error: function(msg){
                if (!_isDebug) console.error("!!! ERROR: " + msg);
            }
        }
    };

    /*
    TsZombieCookie singleton class
     */
    var TsZombieCookie = function(){
        // private variables
        var _self = this;
        var DEFAULT_COOKIE_EXPR_DAYS = 1000;
        var DEFAULT_MAX_TRIES_NUMBER = 5;
        // variables for HTML5 SQLite
        var _SQLiteDatabase = null;
        var _isSQLiteCookieReady = false;
        var DEFAULT_SQLITE_DB_SIZE = 1 * 1024 * 1024; // 1MB of openDatabase capacity
        var DEFAULT_SQLITE_DB_NAME = "Zombie_Cookies_DB";
        var DEFAULT_SQLITE_DB_VERSION = "1.0";
        var DEFAULT_SQLITE_DB_SHORTNAME = "zcdb";

        // variables for IndexedDB
        var _indexedDB = null;
        var _isIndexedDBCookieReady = false;
        var DEFAULT_INDEXEDDB_NAME = "Zombie_Cookies_IndexedDB";
        var DEFAULT_INDEXEDDB_VERSION = 1;
        var _checkedCookiesArray = [];
        var _zombieCookieValue = null;

        var _logService = LogService(); //TODO when use in production, setDebug to false

        var _cookieGettingFunctions = [
            function getDocumentCookie(cookieName){
                var cookieValue;
                var value = "; " + document.cookie;
                var parts = value.split("; " + cookieName + "=");
                if (parts.length == 2) {
                    cookieValue = parts.pop().split(";").shift();
                }
                if (_isValidCookie(cookieValue)) _checkedCookiesArray.push(cookieValue);
                _logService.log("document.cookie: " + cookieValue);
                return cookieValue;
            },
            function getHTML5LocalStorageCookie(cookieName){
                var cookieValue = undefined;
                if (_isBrowserSupportLocalStorage()) {
                    cookieValue = localStorage.getItem(cookieName);
                }
                else {
                    // do nothing
                }
                if (_isValidCookie(cookieValue)) _checkedCookiesArray.push(cookieValue);
                _logService.log("localStorage cookie: " + cookieValue);
                return cookieValue;
            },
            function getHTML5SessionStorageCookie(cookieName){
                var cookieValue = undefined;
                if (_isBrowserSupportSessionStorage()) {
                    cookieValue = sessionStorage.getItem(cookieName);
                }
                else {
                    // do nothing
                }
                if (_isValidCookie(cookieValue)) _checkedCookiesArray.push(cookieValue);
                _logService.log("sessionStorage cookie: " + cookieValue);
                return cookieValue;
            },
            function getHTML5SQLiteCookie(cookieName){
                var cookieValue = undefined;
                if (_isBrowserSupportSQLite()) {
                    try {
                        _SQLiteDatabase = openDatabase(DEFAULT_SQLITE_DB_SHORTNAME, DEFAULT_SQLITE_DB_VERSION, DEFAULT_SQLITE_DB_NAME, DEFAULT_SQLITE_DB_SIZE);
                        _SQLiteDatabase.transaction(function (tx) {
                            tx.executeSql('SELECT * FROM Zombie_Cookie', [], function (tx, results) {
                                var len = results.rows.length;
                                for (var i = 0; i < len; i++){
                                    if (results.rows.item(i).cookieName == cookieName) {
                                        cookieValue = results.rows.item(i).cookieValue;
                                        _isSQLiteCookieReady = true;
                                        _logService.log("HTML5 SQLite cookie: " + cookieValue);
                                    }
                                }
                            }, function (tx, error){});
                        });
                    } catch(e){
                        _logService.error("Error: " + e);
                        return cookieValue;
                    }
                }
                else {
                    // do nothing
                }
                if (_isValidCookie(cookieValue)) _checkedCookiesArray.push(cookieValue);
                return cookieValue;
            },
            function getHTML5IndexedDBCookie(cookieName){
                var cookieValue = undefined;
                if (_isBrowserSupportIndexedDB()){
                    try {
                        _initIndexedDB(); //TODO by default, the initIndexedDB is set to the getCookie function because the getCookie function runs firts
                        var transaction = _indexedDB.transaction(["zombieCookies"], "readonly");
                        var objectStore = transaction.objectStore("zombieCookies",{ keyPath: "cookieName" });
                        var cursor = objectStore.openCursor();
                        cursor.onsuccess = function(e) {
                            var res = e.target.result;
                            if(res){
                                if (res.value.cookieName == ZOMBIE_COOKIE_NAME){
                                    cookieValue = res.value.cookieValue;
                                    _isIndexedDBCookieReady = true;
                                    _logService.log("indexedDB cookie: " + cookieValue);
                                }
                                res.continue();
                            }
                        };
                    } catch (e){
                        _logService.error("Error: " + e);
                    }
                }
                else {
                    // do nothing
                }
                if (_isValidCookie(cookieValue)) _checkedCookiesArray.push(cookieValue);
                return cookieValue;
            },
            function getWindowNameCookie(cookieName){
                try {
                    var cookieValue = undefined;
                    var windowNameVal = window.name;
                    windowNameVal = ";" + windowNameVal; // used for splitting the values in window.name
                    var parts = windowNameVal.split(";" + cookieName + "=");
                    if (parts.length == 2) {
                        cookieValue = parts.pop().split(";").shift();
                    }
                    if (_isValidCookie(cookieValue)) _checkedCookiesArray.push(cookieValue);
                    _logService.log("window.name cookie: " + cookieValue);
                } catch(e) {
                    _logService.error("Error: " + e);
                    return false;
                }
                return cookieValue;
            }
            //TODO needs more methods for getting cookies
        ];
        var _cookieSettingFunctions = [
            function setDocumentCookie(cookieName, cookieValue, cookieExprDays){
                var exprDays = cookieExprDays || DEFAULT_COOKIE_EXPR_DAYS;
                var d = new Date();
                d.setTime(d.getTime() + (24*60*60*exprDays));
                var expires = "expires=" + d.toUTCString();
                var cookieVal = cookieName + "=" + cookieValue + "; " + expires;
                document.cookie = cookieVal;
                return true;
            },
            function setHTML5LocalStorageCookie(cookieName, cookieValue){
                if (_isBrowserSupportLocalStorage()) {
                    localStorage.setItem(cookieName, cookieValue);
                    return true;
                }
                else {
                    return false;
                }
            },
            function setHTML5SessionStorageCookie(cookieName, cookieValue){
                if (_isBrowserSupportSessionStorage()) {
                    sessionStorage.setItem(cookieName, cookieValue);
                    return true;
                }
                else {
                    return false;
                }
            },
            function setHTML5SQLiteCookie(cookieName, cookieValue){
                if(_isBrowserSupportSQLite()){
                    try {
                        _SQLiteDatabase = openDatabase(DEFAULT_SQLITE_DB_SHORTNAME, DEFAULT_SQLITE_DB_VERSION, DEFAULT_SQLITE_DB_NAME, DEFAULT_SQLITE_DB_SIZE);
                        _SQLiteDatabase.transaction(function (tx) {
                            tx.executeSql('CREATE TABLE IF NOT EXISTS Zombie_Cookie (' +
                                'id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, ' +
                                'cookieName TEXT UNIQUE NOT NULL, ' +
                                'cookieValue TEXT NOT NULL)',
                                [],
                                function(tx, result){
                                    _logService.log("Create table done.");
                                },
                                function(tx, err){
                                    _logService.error("Error when creating table.");
                                }
                            );
                            tx.executeSql('INSERT OR REPLACE INTO Zombie_Cookie(cookieName, cookieValue) VALUES (?, ?)',
                                [cookieName, cookieValue],
                                function (tx, rs) {_logService.log("Insert or replace cookie done.");},
                                function (tx, err) {_logService.error("Error when inserting or replacing cookie.");}
                            );
                        });
                        return true;
                    } catch(e){
                        _logService.error("Error: " + e);
                        return false;
                    }
                }
                else {
                    return false;
                }
            },
            function setHTML5IndexedDBCookie(cookieName, cookieValue){
                if(_isBrowserSupportIndexedDB()){
                    try {
                        var transaction = _indexedDB.transaction(["zombieCookies"], "readwrite");
                        transaction.onerror = function(e){
                            _logService.error("Transaction error: ", e.target.error.name + " " + e.target.error.message);
                        };
                        var store = transaction.objectStore("zombieCookies", { keyPath: "cookieName" });
                        var cookie = {
                            cookieName: cookieName,
                            cookieValue: cookieValue
                        };
                        var request = store.put(cookie);
                        return true;
                    } catch(e) {
                        _logService.error("Error: " + e);
                        return false;
                    }
                }
                else {
                    return false;
                }
            },
            function setWindowNameCookie(cookieName, cookieValue){
                try {
                    var oldWindowNameVal = window.name;
                    if (oldWindowNameVal.indexOf(cookieName) < 0){
                        var zc = cookieName + "=" + cookieValue + ";";
                        window.name = zc + oldWindowNameVal; // window.name = "cookieName=cookieValue;oldWindowNameVal"
                        return true;
                    }
                    else {
                        // cookieName already exists, do nothing
                        return false;
                    }
                } catch(e) {
                    _logService.error("Error: " + e);
                    return false;
                }
            }
            //TODO needs more methods for setting cookies
        ];
        var _cookieRemovingFunctions = [
            function removeDocumentCookie(cookieName){
                var d = new Date();
                d.setTime(d.getTime() + (24*60*60*(-DEFAULT_COOKIE_EXPR_DAYS)));
                var expires = "expires=" + d.toUTCString();
                var cookieVal = cookieName + "=" + "-1" + "; " + expires;
                document.cookie = cookieVal;
                return true;
            },
            function removeHTML5LocalStorageCookie(cookieName){
                if (_isBrowserSupportLocalStorage()) {
                    localStorage.removeItem(cookieName);
                    return true;
                }
                else {
                    return false;
                }
            },
            function removeHTML5SessionStorageCookie(cookieName){
                if (_isBrowserSupportSessionStorage()) {
                    sessionStorage.removeItem(cookieName);
                    return true;
                }
                else {
                    return false;
                }
            },
            function removeHTML5SQLiteCookie(cookieName){
                if (_isBrowserSupportSQLite()) {
                    try {
                        _SQLiteDatabase = openDatabase(DEFAULT_SQLITE_DB_SHORTNAME, DEFAULT_SQLITE_DB_VERSION, DEFAULT_SQLITE_DB_NAME, DEFAULT_SQLITE_DB_SIZE);
                        _SQLiteDatabase.transaction(function (tx) {
                            tx.executeSql('DELETE FROM Zombie_Cookie WHERE cookieName = ?', [cookieName], null, null);
                        });
                        return true;
                    } catch(e) {
                        _logService.error("Error: " + e);
                        return false;
                    }
                }
                else {
                    return false;
                }
            },
            function removeHTML5IndexedDBCookie(cookieName){
                if(_isBrowserSupportIndexedDB()){
                    try {
                        var request = _indexedDB.transaction(["zombieCookies"], "readwrite")
                            .objectStore("zombieCookies")
                            .delete(cookieName);
                        request.onsuccess = function(event) {
                            return true;
                        };
                    } catch(e) {
                        _logService.error("Error: " + e);
                        return false;
                    }
                }
                else {
                    return false;
                }
            },
            function removeWindowNameCookie(cookieName){
                window.name = ""; //TODO temporarily delete all data in window.name
                return true;
            }
        ];

        // private functions
        function _isValidCookie(cookieValue){
            return (cookieValue !== null
            && (typeof cookieValue !== 'undefined')
            && cookieValue);
        }
        function _getModeElement(array)
        {
            if(array.length == 0)
                return null;
            var modeMap = {};
            var maxEl = array[0], maxCount = 1;
            for(var i = 0; i < array.length; i++)
            {
                var el = array[i];
                if(modeMap[el] == null)
                    modeMap[el] = 1;
                else
                    modeMap[el]++;
                if(modeMap[el] > maxCount)
                {
                    maxEl = el;
                    maxCount = modeMap[el];
                }
            }
            return maxEl;
        }
        function _isBrowserSupportLocalStorage(){
            try {
                return 'localStorage' in window && window['localStorage'] !== null;
            } catch(e) {
                return false;
            }
        }
        function _isBrowserSupportSessionStorage(){
            try {
                return window['sessionStorage'] !== null;
            } catch(e) {
                return false;
            }
        }
        function _isBrowserSupportSQLite(){
            try {
                return window['openDatabase'] !== null && typeof window['openDatabase'] != "undefined";
            } catch(e) {
                return false;
            }
        }
        function _isBrowserSupportIndexedDB(){
            try {
                window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
                window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;
                window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;
                return !!window.indexedDB;
            } catch(e) {
                return false;
            }
        }
        function _initIndexedDB(){
            try {
                var idbRequest = indexedDB.open(DEFAULT_INDEXEDDB_NAME, DEFAULT_INDEXEDDB_VERSION);
                idbRequest.onupgradeneeded = function(event) {
                    var thisDB = event.target.result;
                    if(!thisDB.objectStoreNames.contains("zombieCookies")) {
                        thisDB.createObjectStore("zombieCookies", { keyPath: "cookieName" });
                    }
                };
                idbRequest.onerror = function(event) {
                    _logService.error("OpenDb FAILED: " + event.target.errorCode);
                };
                idbRequest.onsuccess = function(event) {
                    _logService.log("openDb DONE.");
                    _indexedDB = event.target.result;
                };
            } catch(e) {
                _logService.error("Error: " + e);
            }
        }
        function _getCookie(cookieName, cb, i){
            _cookieGettingFunctions.forEach(function(callback){
                callback(cookieName);
            });
            if (_isSQLiteCookieReady && _isIndexedDBCookieReady){ //TODO && more storages ?
                var res = _getModeElement(_checkedCookiesArray);
                if (res !== null) {
                    _zombieCookieValue = res;
                    cb(_zombieCookieValue);
                }
                else {
                    cb(null);
                }
            }
            else {
                if (i < DEFAULT_MAX_TRIES_NUMBER){
                    i += 1;
                    setTimeout(function(){
                        _getCookie(cookieName, cb, i);
                    }, 300);
                }
                else {
                    var res = _getModeElement(_checkedCookiesArray);
                    if (res !== null) {
                        _zombieCookieValue = res;
                        cb(_zombieCookieValue);
                    }
                    else {
                        cb(null);
                    }
                }
            }
        }

        return {
            getCookie: function(cookieName, cb){
                var i = 0;
                _getCookie(cookieName, cb, i);
            },
            setCookie: function(cookieName, cookieValue, cookieExprDays){
                _cookieSettingFunctions.forEach(function(callback){
                    callback(cookieName, cookieValue, cookieExprDays);
                });
            },
            removeCookie: function(cookieName){
                _cookieRemovingFunctions.forEach(function(callback){
                    callback(cookieName);
                });
            }
        }
    };

    /*
    Utility functions
     */
    var TsZombieCookieUtilities = function(){
        function _getCookie(cookieName){
            var value = "; " + document.cookie;
            var parts = value.split("; " + cookieName + "=");
            if (parts.length == 2) {
                var cookieValue = parts.pop().split(";").shift();
                return cookieValue;
            }
        }
        return {
            displayCookie: function(){ //TODO deprecated ?
                var cookieVal = _getCookie(ZOMBIE_COOKIE_NAME) || "hasn't been set yet";
                document.getElementById("current-cookie-value").textContent = cookieVal;
            },
            getRandomNumber: function(min, max)
            {
                return Math.floor(Math.random()*(max - min + 1) + min);
            }
        }
    };

    var myZombieCookieUtilities = TsZombieCookieUtilities();
    var myZombieCookie = TsZombieCookie();
    var zombieCookieValue = myZombieCookie.getCookie(ZOMBIE_COOKIE_NAME, function(res){
        if (res !== null){
            document.getElementById("current-cookie-value").textContent = res;
            myZombieCookie.setCookie(ZOMBIE_COOKIE_NAME, res, 1000);
        }
        else {
            document.getElementById("current-cookie-value").textContent = "has not been set yet.";
        }

    });

    /*
     Event handlers
     */
    setCookieBtn.onclick = function(){
        // set the zombie cookie to expire in 1000 days
        myZombieCookie.setCookie(ZOMBIE_COOKIE_NAME, myZombieCookieUtilities.getRandomNumber(1, DEFAULT_MAX_USERID), 1000);
        myZombieCookieUtilities.displayCookie();
    };

    deleteCookieBtn.onclick = function(){
        // delete the zombie cookie by setting it's expiring day to a day in the past
        myZombieCookie.removeCookie(ZOMBIE_COOKIE_NAME);
        myZombieCookieUtilities.displayCookie();
    };

    showCookieBtn.onclick = function(){
        console.log("> document.cookie: " + document.cookie);
    };
})();