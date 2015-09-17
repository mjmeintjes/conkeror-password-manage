(function() {
    require('password-manage-hooks');
    require('password-manage-utils');
    provide('password-manage-pass');
    function register_self(args, services) {
        utils.debug(`checking whether we should register pass manager for arguments ${args}`);
        if (args.type !== 'pass')
            return;
        var pass = new Pass(services.user, services.browser, services.shell, args);
        var name = `pass - ${args.username}`;
        register_password_generator(name, pass.generate_and_save_password.bind(pass));
        //register_password_retriever(name, pass.get_username_and_password.bind(pass));
    }
    register_password_manager_installer(register_self);

    var Pass = function(user, browser, shell, args) {
        this.user = user;
        this.browser = browser;
        this.login = args.username;
        this.password_name_template = args.password_name_template || "Accounts/{domain}";
        this.shell = shell;
    };
    var STRIP_COLORS = String.raw`sed -r "s/\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?[m|K]//g"`;
    Pass.prototype.generate_and_save_password = function(domain, username, length, include_symbol) {
        utils.assertNotEmpty(domain, 'domain');
        utils.assertNotEmpty(username, 'username');
        utils.assertNotEmpty(length, 'length');
        utils.debug(`using pass to generate password, and then save that password against the supplied username and domain`);
        var no_symbols = include_symbol ? "--no-symbols" : "";
        var name = utils.string_format(this.password_name_template, {
            domain: domain,
            username: username
        });
        utils.debug(`testing if a password named ${name} already exists`);
        //doing it the hard way because 'pass' seems to assume 'forced' when running from Conkeror
        var existing = yield this.get_command(`pass show "${name}" | ${STRIP_COLORS}`, "", function(results){
            utils.debug("EXISTING: " + utils.obj2str(results));
            if (/not in the password store/.test(results.error)){
                return true;
            }
            throw new interactive_error(`could not generate password named ${name} as one already exists`);
        });
        var command = `pass generate ${no_symbols} "${name}" ${length} | ${STRIP_COLORS}`; 
        var results = yield this.get_command(command);
        if (/entry already exists/m.test(results.data)){
            throw new interactive_error(`could not generate password named ${name} as one already exists`);
        }

        var result = clean_output(results.data);
        yield co_return(result);
    };
    function clean_output(output) {
        output = output.split("\n");
        return output[1];
    }
    Pass.prototype.get_command = function(comm, input, error_ok_func=null){
        utils.debug(`executing provided shell command: ${comm} and returning results as an object containing data, error and return_code`);
        utils.assertNotEmpty(comm, "comm");
        var self = this;

        var results = yield this.shell.get_command(comm, input);

        if (error_ok_func && !error_ok_func(results)){
            if (!results.data && results.error) {
                throw new interactive_error(`error received from Pass - ${results.error}`);
            }
            else if (!results.error && !results.data){
                throw new interactive_error(`no result retrieved from Pass`);
            }
        }
        yield co_return(results);
    };
    
})();
