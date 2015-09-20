'use strict';

var _templateObject = _taggedTemplateLiteral(['sed -r "s/\u001b[([0-9]{1,2}(;[0-9]{1,2})?)?[m|K]//g"'], ['sed -r "s/\\x1B\\[([0-9]{1,2}(;[0-9]{1,2})?)?[m|K]//g"']);

function _taggedTemplateLiteral(strings, raw) { return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

(function () {
    require('password-manage-hooks');
    require('password-manage-utils');
    provide('password-manage-pass');
    function register_self(args, services) {
        pmutils.debug('checking whether we should register pass manager for arguments ' + args);
        if (args.type !== 'pass') return;
        var pass = new Pass(services.user, services.browser, services.shell, args);
        var name = 'pass - ' + args.username;
        register_password_generator(name, pass.generate_and_save_password.bind(pass));
        register_password_retriever(name, pass.get_username_and_password.bind(pass));
    }
    register_password_manager_installer(register_self);

    var Pass = function Pass(user, browser, shell, args) {
        this.user = user;
        this.browser = browser;
        this.login = args.username;
        this.password_name_template = args.password_name_template || "Accounts/{domain}";
        this.shell = shell;
    };
    var STRIP_COLORS = String.raw(_templateObject);
    Pass.prototype.generate_and_save_password = function (domain, username, length, include_symbol) {
        pmutils.assertNotEmpty(domain, 'domain');
        pmutils.assertNotEmpty(username, 'username');
        pmutils.assertNotEmpty(length, 'length');
        pmutils.debug('using pass to generate password, and then save that password against the supplied username and domain');
        var name = pmutils.string_format(this.password_name_template, {
            domain: domain,
            username: username
        });
        pmutils.debug('testing if a password named ' + name + ' already exists');
        var existing_passwords = yield(this.list_passwords());
        if (existing_passwords.indexOf(name) !== -1) {
            throw new interactive_error('could not generate password named \'' + name + '\' as one already exists');
        }
        var symbols = include_symbol ? "--symbols" : "";
        var password = yield(this.get_command('pwgen ' + symbols + ' ' + length + ' 1'));
        password = password.data;
        var input = password + '\nusername:' + username + '\nurl:' + domain + '\n';
        var results = yield(this.get_command('pass insert -m -f "' + name + '"', input));
        yield(co_return(password));
    };
    Pass.prototype.get_username_and_password = function (domain) {
        pmutils.debug('retrieving username and password for ' + domain);
        var passwords = yield(this.list_passwords());
        var site = yield(this.user.ask_to_select("select site: ", passwords, domain));
        var fields = yield(this.get_command('pass show "' + site + '"'));
        fields = ('password:' + fields.data).split('\n');
        fields = pmutils.convert_lines_to_object(fields);
        yield(co_return(fields));
    };

    function clean_output(output) {
        output = output.split("\n");
        return output[1];
    }
    Pass.prototype.list_passwords = function () {
        var results = yield(this.get_command('find $HOME/.password-store/ -name "*.gpg"'));
        var passwords = results.data.split("\n");
        passwords = passwords.map(function (pass) {
            return pass.split(".password-store/")[1].replace('.gpg', '');
        });
        yield(co_return(passwords));
    };
    Pass.prototype.get_command = function (comm, input) {
        var error_ok_func = arguments.length <= 2 || arguments[2] === undefined ? null : arguments[2];

        pmutils.debug('executing provided shell command: ' + comm + ' and returning results as an object containing data, error and return_code');
        pmutils.assertNotEmpty(comm, "comm");
        var self = this;

        var results = yield(this.shell.get_command(comm, input));

        if (error_ok_func && !error_ok_func(results)) {
            yield(co_return(results));
            return;
        }
        if (/cancelled by user/.test(results.error)) {
            pmutils.debug('user cancelled');
            throw new interactive_error('cancelled password prompt');
        } else if (!results.data && results.error) {
            throw new interactive_error('error received from Pass - ' + results.error);
        } else if (!results.error && !results.data) {
            throw new interactive_error('no result retrieved from Pass');
        }
        yield(co_return(results));
    };
})();