(function() {
    provide('password-manage-utils');
    var Utils = function() {};
    // * Utility functions
    // ** Debug function - ONLY FOR USE DURING DEVELOPMENT, as this function will send sensitive information like passwords to the console log
    Utils.prototype.debug = function(msg){
        if (password_manage_debug_p){
            dumpln("PASSWD-MANAGE: " + msg);
        }
    };
    Utils.prototype.info = function(msg){
        dumpln(msg);
    };
    Utils.prototype.assertNotEmpty = function(variable, variable_name) {
        this.assert(variable, `${variable_name} cannot be empty`);
    };
    Utils.prototype.convert_lines_to_object = function(lines) {
        var ret = {};
        lines.forEach(function(field) {
            field = field.split(/:(.+)?/);
            var key = field[0].trim();
            var val = field[1].trim();
            ret[key] = val;
        });
        return ret;
    };
    Utils.prototype.assert = function(condition, message) {
        if (!condition) {
            message = message || "Assertion failed";
            if (typeof Error !== "undefined") {
                throw new Error(message);
            }
            throw message; // Fallback
        }
    };
    Utils.prototype.obj2str = function(obj) {
        return JSON.stringify(obj);
    };
    Utils.prototype.string_format = function(str, replacements) {
        return str.replace(/{([^}]+)}/g, function(_, key) {
            return replacements.hasOwnProperty(key) ? replacements[key] : '';
        });
    };
    Utils.prototype = Object.seal(Utils.prototype);
    Utils = Object.seal(Utils);
    var utils = new Utils();
    utils.debug(`adding utils installation function to conkeror (${conkeror}) namespace`);
    conkeror.install_password_manage_utils = function(scope) {
        dump_obj(scope);
        scope.utils = utils;
    };
    install_password_manage_utils(this);
})();

