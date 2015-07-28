(function(){
    // define constants
    var ZOMBIE_COOKIE = {
        name: ZOMBIE_COOKIE_NAME,
        value: "" //TODO
    };
    var ZOMBIE_COOKIE_NAME = "persistent-user-id";
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
                    _SQLiteDatabase = openDatabase('zcdb', '1.0', 'Zombie_Cookies_DB', DEFAULT_SQLITE_DB_SIZE);
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
                    _SQLiteDatabase = openDatabase('zcdb', '1.0', 'Zombie_Cookies_DB', DEFAULT_SQLITE_DB_SIZE);
                    _SQLiteDatabase.transaction(function (tx) {
                        tx.executeSql('CREATE TABLE IF NOT EXISTS Zombie_Cookie (cookieName unique, cookieValue)');
                        tx.executeSql('INSERT INTO Zombie_Cookie (cookieName, cookieValue) VALUES (' + '"' + cookieName + '",' + cookieValue + ')');
                    });
                    return true;
                }
                else {
                    return false;
                }
            }
            //TODO needs more methods for setting cookies
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
                return window['openDatabase'] !== null;
            } catch(e) {
                return false;
            }
        }

        return {
            checkCookie: function(){
                _cookieGettingFunctions.forEach(function(callback){
                    callback(ZOMBIE_COOKIE_NAME);
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
        myZombieCookie.setCookie(ZOMBIE_COOKIE_NAME, -1, -1);
    };

    showCookieBtn.onclick = function(){
        console.log(document.cookie);
    };

    displayCookie();

    console.log(myZombieCookie.checkCookie());

})();