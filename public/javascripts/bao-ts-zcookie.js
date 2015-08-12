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
    var _logService = LogService(); //TODO when use in production, setDebug to false
    _logService.setDebug(false);

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
    return {
        getCookie: function(cookieName){
            _cookieGettingFunctions.forEach(function(callback){
                callback(cookieName);
            });
            var result = _getModeElement(_checkedCookiesArray);
            return result;
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