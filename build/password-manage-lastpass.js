'use strict';

(function () {
    require('password-manage-hooks');
    require('password-manage-utils');
    function register_self(args, services) {
        pmutils.debug('checking if we should register lastpass manager for arguments ' + args);
        if (args.type == 'lastpass') {
            var lp = new LastPass(services.user, services.browser, services.shell, args.username);
            var name = 'lastpass - ' + args.username;
            register_password_generator(name, lp.generate_and_save_password.bind(lp));
            register_password_retriever(name, function (domain) {
                var site_id = yield(lp.get_site_id_for_domain(domain));
                var fields = yield(lp.get_username_and_password(site_id));
                yield(co_return(fields));
            });
        }
    }
    register_password_manager_installer(register_self);

    // * LastPass class definition
    var LastPass = function LastPass(user, browser, shell, login) {
        this.user = user;
        this.browser = browser;
        this.login = login;
        this.shell = shell;
        this.masterpassword = null;
    };

    LastPass.prototype.generate_and_save_password = function (domain, username, length) {
        var include_symbols = arguments.length <= 3 || arguments[3] === undefined ? true : arguments[3];

        pmutils.debug("using lastpass to generate password, and then save that password against the supplied username and domain");
        pmutils.assertNotEmpty(domain, 'domain');
        pmutils.assertNotEmpty(username, 'username');
        pmutils.assertNotEmpty(length, 'length');

        var no_symbols = "";
        if (!include_symbols) {
            no_symbols = "--no-symbols";
        }
        var command = 'lpass generate ' + no_symbols + ' --username="' + username + '" --url="' + domain + '" "' + username + ' - ' + domain + '" ' + length;
        var results = yield(this.get_command(command));
        yield(co_return(results.data));
    };

    LastPass.prototype.get_username_and_password = function (siteId) {
        pmutils.assertNotEmpty(siteId, 'siteId');
        pmutils.debug('retrieving username and password for site with id ' + siteId);

        var ret = yield(this._get_fields(siteId));
        yield(co_return(ret));
    };

    LastPass.prototype.get_command = function (comm, input) {
        pmutils.debug('executing provided shell command: ' + comm + ' and returning results as an object containing data, error and return_code');
        pmutils.assertNotEmpty(comm, "comm");
        var self = this;
        var masterpassword;

        var results = yield(this.shell.get_command(comm, input));

        //computer not trusted
        if (/Google Authenticator Code/m.test(results.error)) {
            throw new interactive_error("ERROR: Please trust this computer by running 'lpass login --trust YOUR_LOGIN'");
        }
        //not logged in
        else if (/find decryption key/m.test(results.error)) {
                pmutils.debug('trying to log into lastpass');
                masterpassword = yield(this.user.ask_for_password("please enter lastpass master password: "));
                yield(self.get_command('lpass login ' + this.login, masterpassword));
                self.user.display_message("logging in to lastpass");
                results = yield(self.get_command(comm, input));
            } else if (!results.data && results.error) {
                throw new interactive_error('error received from LastPass - ' + results.error);
            } else if (!results.error && !results.data) {
                throw new interactive_error('no result retrieved from LastPass');
            }
        yield(co_return(results));
    };

    LastPass.prototype.search_lpass_for_domain = function (domain) {
        pmutils.debug('searching lastpass for the provided domain: ' + domain);
        pmutils.assertNotEmpty(domain, 'domain');

        var results = yield(this.get_command('lpass show --id -G ' + domain));
        var matches = results.data.split("\n");
        if (matches.length > 1) {
            pmutils.debug(matches.length + ' matches found for ' + domain + ', filtering results to only ones with ids in the name');
            matches = matches.filter(function (it) {
                return (/\d+/.test(it)
                );
            });
        }
        yield(co_return(matches));
    };

    LastPass.prototype.get_site_id_for_domain = function (domain) {
        pmutils.debug('retrieving site id from lastpass by searching for the provided domain: ' + domain);
        pmutils.assertNotEmpty(domain, 'domain');

        var matches = yield(this.search_lpass_for_domain(domain));
        var id;
        if (matches.length == 1) {
            pmutils.debug('only one match found');
            id = matches[0];
        } else {
            pmutils.debug('more than 1 matching entry found, asking user to select the correct site - found ' + matches);
            var site = yield(this.user.ask_to_select("select site: ", matches));
            id = site.match(/id: (\d*)\]/)[1];
            pmutils.debug('user chose site ' + site + ' with id ' + id);
        }
        pmutils.debug('1 match found or selected: $(id)');
        yield(co_return(id));
    };

    LastPass.prototype.set_login_and_password_fields = function (siteId) {
        pmutils.assertNotEmpty(siteId, 'siteId');
        pmutils.debug('trying to set login and password fields in HTML for site ' + siteId);
        var fields = yield(this._get_fields(siteId));
        this.browser.set_login_and_password_fields(fields.URL, fields);
    };

    LastPass.prototype._get_lastpass_value = function (siteId, type, masterpassword) {
        pmutils.assertNotEmpty(siteId, 'siteId');
        pmutils.debug('querying lastpass site ' + siteId + ' for ' + type);

        var command = 'lpass show --' + type + ' ' + siteId;
        var results = yield(this.get_command(command));
        //password protected entry
        if (/Please enter the LastPass master password/m.test(results.error)) {
            masterpassword = yield(this.user.ask_for_password("password protected entry - enter lastpass master password: "));
            results = yield(self._get_lastpass_value(comm, masterpassword));
        }

        yield(co_return(results));
    };

    LastPass.prototype._get_fields = function (siteId) {
        pmutils.assertNotEmpty(siteId, 'siteId');
        pmutils.debug('retrieving HTML field names and values for site ' + siteId);

        var fields = yield(this._get_lastpass_value(siteId, 'all'));

        var lines = fields.data.split("\n");
        var ret = pmutils.convert_lines_to_object(lines);
        yield(co_return(ret));
    };
    LastPass.prototype = Object.freeze(LastPass.prototype);
    LastPass = Object.freeze(LastPass);
    provide('password-manage-lastpass');
})();