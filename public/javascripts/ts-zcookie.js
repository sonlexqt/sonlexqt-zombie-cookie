(function(){
    // define constants
    var ZOMBIE_COOKIE_NAME = "persistent-user-id"; //TODO change this name. Also, we will store a lot of info, not just this one
    var INFINITY_EXPIRING_DAY = "Fri, 31 Dec 9999 23:59:59 GMT";
    var DEFAULT_MAX_USERID = 1000;

    // define variables
    var setCookieBtn = document.getElementById("btn-set-cookie");
    var deleteCookieBtn = document.getElementById("btn-delete-cookie");
    var showCookieBtn = document.getElementById("btn-show-cookie");

    /*
    TsZombieCookie singleton class
     */
    var TsZombieCookie = function(){
        // private variables
        var DEFAULT_COOKIE_EXPR_DAYS = 1000;
        var DEFAULT_SQLITE_DB_SIZE = 1 * 1024 * 1024; // 1MB of openDatabase capacity
        var DEFAULT_SQLITE_DB_NAME = "Zombie_Cookies_DB";
        var DEFAULT_SQLITE_DB_VERSION = "1.0";
        var DEFAULT_SQLITE_DB_SHORTNAME = "zcdb";
        var _indexedDB = null;
        var DEFAULT_INDEXEDDB_NAME = "Zombie_Cookies_IndexedDB";
        var DEFAULT_INDEXEDDB_VERSION = 1;
        var _checkedCookiesArray = [];
        var _zombieCookieValue = null;
        var _SQLiteDatabase = null;


        var _cookieGettingFunctions = [
            function getDocumentCookie(cookieName){
                var value = "; " + document.cookie;
                var parts = value.split("; " + cookieName + "=");
                if (parts.length == 2) {
                    var cookieValue = parts.pop().split(";").shift();
                    if (_isValidCookie(cookieValue)) _checkedCookiesArray.push(cookieValue);
                    return cookieValue;
                }
            },
            function getLocalSharedObjectsCookie(cookieName){ //TODO need implementation
                var cookieValue = undefined;
                if (_isValidCookie(cookieValue)) _checkedCookiesArray.push(cookieValue);
                return undefined;
            },
            function getSilverlightCookie(cookieName){ //TODO need implementation
                var cookieValue = undefined;
                if (_isValidCookie(cookieValue)) _checkedCookiesArray.push(cookieValue);
                return undefined;
            },
            function getHTML5LocalStorageCookie(cookieName){
                var cookieValue = undefined;
                if (_isBrowserSupportLocalStorage()) {
                    cookieValue = localStorage.getItem(cookieName);
                    if (_isValidCookie(cookieValue)) _checkedCookiesArray.push(cookieValue);
                    return cookieValue;
                }
                else {
                    return undefined;
                }
            },
            function getHTML5SessionStorageCookie(cookieName){
                var cookieValue = undefined;
                if (_isBrowserSupportSessionStorage()) {
                    cookieValue = sessionStorage.getItem(cookieName);
                    if (_isValidCookie(cookieValue)) _checkedCookiesArray.push(cookieValue);
                    return cookieValue;
                }
                else {
                    return undefined;
                }
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
                                    }
                                }
                                if (_isValidCookie(cookieValue)) _checkedCookiesArray.push(cookieValue);
                                return cookieValue;
                            });
                        });
                    } catch(e){
                        console.log("Error: " + e);
                        return cookieValue;
                    }
                }
                else {
                    return undefined;
                }
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
                                }
                                res.continue();
                            }
                        };
                        if (_isValidCookie(cookieValue)) _checkedCookiesArray.push(cookieValue);
                        return cookieValue;
                    } catch (e){
                        console.log("Error: " + e);
                    }
                }
                else {
                    return undefined;
                }
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
                console.log(cookieVal);
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
                            tx.executeSql('CREATE TABLE IF NOT EXISTS Zombie_Cookie (cookieName unique, cookieValue)');
                            tx.executeSql('INSERT INTO Zombie_Cookie (cookieName, cookieValue) VALUES (?, ?)', [cookieName, cookieValue], null, null);
                        });
                        return true;
                    } catch(e){
                        console.log("Error: " + e);
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
                            console.log("Transaction error: ", e.target.error.name + " " + e.target.error.message);
                        };
                        var store = transaction.objectStore("zombieCookies", { keyPath: "cookieName" });
                        var cookie = {
                            cookieName: cookieName,
                            cookieValue: cookieValue
                        };
                        var request = store.put(cookie);
                    } catch(e) {
                        console.log("Error: " + e);
                    }
                }
                else {
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
                console.log(cookieVal);
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
                        console.log("Error: " + e);
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
                        console.log("Error: " + e);
                        return false;
                    }
                }
                else {
                    return false;
                }
            }
        ];

        // private functions
        function _isValidCookie(cookieValue){
            return (cookieValue !== null
            && (typeof cookieValue !== 'undefined')
            && cookieValue); //TODO the logic needs improvements
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
                    console.log("OpenDb FAILED: " + event.target.errorCode);
                };
                idbRequest.onsuccess = function(event) {
                    console.log("openDb DONE");
                    _indexedDB = event.target.result;
                };
            } catch(e) {
                console.log("Error: " + e);
            }
        }

        return {
            getCookie: function(cookieName){
                _cookieGettingFunctions.forEach(function(callback){
                    callback(cookieName);
                });
                var res = _getModeElement(_checkedCookiesArray);
                if (res !== null) {
                    _zombieCookieValue = res;
                    return res;
                }
                else {
                    return null;
                }
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
    function getCookie(cookieName){
        var value = "; " + document.cookie;
        var parts = value.split("; " + cookieName + "=");
        if (parts.length == 2) {
            var cookieValue = parts.pop().split(";").shift();
            return cookieValue;
        }
    }
    function displayCookie(){
        var cookieVal = getCookie(ZOMBIE_COOKIE_NAME) || "hasn't been set yet";
        document.getElementById("current-cookie-value").textContent = cookieVal;
    }
    function getRandomNumber(min, max)
    {
        return Math.floor(Math.random()*(max - min + 1) + min);
    }

    var myZombieCookie = TsZombieCookie();
    var zombieCookieValue = myZombieCookie.getCookie(ZOMBIE_COOKIE_NAME);
    myZombieCookie.setCookie(ZOMBIE_COOKIE_NAME, zombieCookieValue, 1000);
    displayCookie();

    /*
     Event handlers
     */
    setCookieBtn.onclick = function(){
        // set the zombie cookie to expire in 1000 days
        myZombieCookie.setCookie(ZOMBIE_COOKIE_NAME, getRandomNumber(1, DEFAULT_MAX_USERID), 1000);
        displayCookie();
    };

    deleteCookieBtn.onclick = function(){
        // delete the zombie cookie by setting it's expiring day to a day in the past
        myZombieCookie.removeCookie(ZOMBIE_COOKIE_NAME);
        displayCookie();
    };

    showCookieBtn.onclick = function(){
        console.log(document.cookie);
    };

    displayCookie();

})();