(function(){
    info(`loading passwd-manage module: provides functionality to use external password managers to retrieve and add passwords for Conkeror`);
    info(`currently only supports LastPass (http://www.lastpass.com)`);

    define_variable("passwd_manage_lastpass_username", "",
                    "Default username to login to LastPass");
    define_variable("passwd_manage_setup_keybindings_p", true,
                    "NOT WORKING? - Whether to setup the default keybindings");
    define_variable("passwd_manage_password_paste_key", "C-j",
                    "Key to use to paste passwords and usernames into focused text boxes");
    define_variable("passwd_manage_debug_p", false,
                    "Enable debug mode. WARNING - this will print confidential material, like your passwords, to the console, and possible other logs!");

    var LastPass = function(I, login){
        this.I = I;
        this.login = login;
        this.masterpassword = "";
    };
    LastPass.prototype.ensure_we_have_masterpassword = function(force) {
        I = this.I;
        if (this.masterpassword && !force)
            return;
        this.masterpassword = yield I.minibuffer.read($prompt = "please enter lastpass master password: ");
    };

    LastPass.prototype.echo_message = function(message) {
        var window = this.I.window;
        debug(`displaying following message to user: ${message}`);
        window.minibuffer.message(message);
    };

    LastPass.prototype.get_command = function(comm, input, force_masterpass_ask=false){
        debug(`executing provided shell command: ${comm} and returning results as an object containing data, error and return_code`);
        assertNotEmpty(comm, "comm");
        var self = this;
        var results = {
            data: "",
            error: ""
        };
        var result = yield shell_command(comm,
                                         $fds = [{ output: async_binary_string_writer(input) },
                                                 { input: async_binary_reader(function (s) results.data+=s||"") },
                                                 { input: async_binary_reader(function (s) results.error+=s||"") }]);
        results.return_code = result;
        if (/Google Authenticator Code/m.test(results.error)){
            throw new interactive_error("ERROR: Please trust this computer by running 'lpass login --trust YOUR_LOGIN'");
        }
        else if (/find decryption key/m.test(results.error) ||
                 /Failed to enter correct password/m.test(results.error)){
            debug(`trying to log into lastpass`);
            yield self.ensure_we_have_masterpassword(force_masterpass_ask);
            yield self.get_command(`lpass login ${this.login}`, self.masterpassword);
            self.echo_message("logging in to lastpass");
            results = yield self.get_command(comm, input, true);
            return;
        }
        else if (results.error) {
            throw new interactive_error(`error received from LastPass - ${results.error}`);
        }
        else if (!results.error && !results.data){
            throw new interactive_error(`no result retrieved from LastPass`);
        }
        else if (results.code == 256){
            throw new interactive_error('error 256 returned from LastPass');
        }
        results.data = results.data.trim();
        debug(`received the following results from running the command: ${JSON.stringify(results)}`);
        yield co_return(results);
    };
    LastPass.prototype.generate_and_save_password = function (domain, username, length, include_symbols=true) {
        debug("using lastpass to generate password, and then save that password against the supplied username and domain");
        assertNotEmpty(domain, 'domain');
        assertNotEmpty(username, 'username');
        assertNotEmpty(length, 'length');
        var no_symbols = "";
        if (!include_symbols){
            no_symbols = "--no-symbols";
        }
        var results = yield this.get_command(`lpass generate ${no_symbols} --username="${username}" --url="${domain}" "${username} - ${domain}" ${length}`);
        yield co_return(results.data);
    };
    LastPass.prototype.find_lpass_matches = function(domain) {
        debug("finding a matching site entry (or entries) from lastpass by searching using the provided id");
        assertNotEmpty(domain, 'domain');
        var results;
        this.echo_message("loading lastpass results for " + domain);
        results = yield this.get_command(`lpass show --id -G ${domain}`);

        this.echo_message("retrieved lastpass results");
        yield co_return(results);
    };
    LastPass.prototype.search_lpass_for_domain = function(domain) {
        debug(`searching lastpass for the provided domain: ${domain}`);
        assertNotEmpty(domain, 'domain');
        var results = yield this.find_lpass_matches(domain);
        var matches = results.data.split("\n");
        if (matches.length > 1){
            matches = matches.filter(function(it) {
                return /\d+/.test(it);
            });
        }
        yield co_return(matches);
    };
    LastPass.prototype.get_site_id_for_domain = function(domain){
        var I = this.I;
        debug(`retrieving site id from lastpass by searching for the provided domain: ${domain}`);
        assertNotEmpty(domain, 'domain');
        var matches = yield this.search_lpass_for_domain(domain);
        var id;
        if (matches.length == 1){
            debug(`only one match found`);
            id = matches[0];
        }
        else {
            debug(`more than 1 matching entry found, asking user to select the correct site - found ${matches}`);
            var completer = new all_word_completer(
                $completions = matches
            );
            var site = yield I.minibuffer.read($prompt = "choose site: ",
                                               $completer = completer,
                                               $require_match = true,
                                               $select = true,
                                               $default_completion = matches[0],
                                               $auto_complete_initial = true,
                                               $auto_complete = true
                                              );

            debug("chosen site: " + site);
            id = site.match(/id: (\d*)\]/)[1];
        }
        debug(`1 match found or selected: $(id)`);
        yield co_return(id);
    };

    LastPass.prototype.get_lastpass_value = function(siteId, type, masterpass=""){
        assertNotEmpty(siteId, 'siteId');
        debug(`querying lastpass site ${siteId} for ${type}`);
        var command = "lpass show --" + type + " " + siteId;
        var results = yield this.get_command(command, masterpass);
        if (/enter the LastPass master password/.test(results.error)) {
            debug(`password protected entry found - need to re-enter LastPass master password`);
            this.ensure_we_have_masterpassword();
            results = yield this.get_lastpass_value(siteId, type, this.masterpass);
        }
        yield co_return(results);
    };

    LastPass.prototype.get_username_and_password = function(siteId) {
        assertNotEmpty(siteId, 'siteId');
        debug(`retrieving username and password for site with id ${siteId}`);
        var username = yield this.get_lastpass_value(siteId, 'username');
        var password = yield this.get_lastpass_value(siteId, 'password');

        yield co_return({
            username: username.data,
            password: password.data
        });
    };

    LastPass.prototype.get_fields = function(siteId) {
        assertNotEmpty(siteId, 'siteId');
        debug(`retrieving HTML field names and values for site ${siteId}`);
        var fields = yield this.get_lastpass_value(siteId, 'all');

        var lines = fields.data.split("\n");
        lines = lines.filter(function(line) {
            return !/URL:/.test(line);
        });
        yield co_return(lines);

    };

    LastPass.prototype.set_login_and_password_fields = function(siteId){
        var I = this.I;
        assertNotEmpty(siteId, 'siteId');
        debug(`trying to set login and password fields in HTML for site ${siteId}`);
        var buffer = I.buffer;
        var fields = yield this.get_fields(siteId);
        debug(`CONFIDENTIAL: found fields ${fields} in lastpass`);

        // TODO insert filter to only fill fields on the matching url to prevent phising attempts - similar to how LastPass extension does it
        //var current_domain = this.get_current_domain();
 

        fields.forEach(function(field) {
            debug(`CONFIDENTIDAL: setting value for field ${field}`);
            field = field.split(":");
            if (field.length < 2)
                return;

            var key = field[0].trim();
            var val = field[1].trim();
            var el = [buffer.document.getElementById(key)];
            if (!el.length)
                el = buffer.document.getElementsByName(key);
            if (!el.length)
                el = buffer.document.getElementsByClassName(key);

            el = el[0];
            if (!el){
                debug(`could not find a field named ${key} - not setting anything for this field`);
                return;
            }
            el.value = val;
        });
    };

    LastPass.prototype.get_current_domain = function(){
        var I = this.I;
        debug(`retrieving current domain (uses a slow hack, but it works and not too worried about performance)`);
        var domain = I.buffer.document.location.href;
        var tmp_a = I.buffer.document.createElement('a');
        tmp_a.href = domain;
        domain = tmp_a.hostname;
        debug(`found current domain: ${domain}`);
        return domain;
    };

    // * Utility functions
    // ** Debug function - ONLY FOR USE DURING DEVELOPMENT, as this function will send sensitive information like passwords to the console log
    function debug(msg){
        if (typeof passwd_manage_debug_p !== 'undefined' && passwd_manage_debug_p){
            dumpln(msg);
        }
    }
    function info(msg){
        dumpln(msg);
    }
    function assertNotEmpty(variable, variable_name) {
        assert(variable, `${variable_name} cannot be empty`);
    }
    function assert(condition, message) {
        if (!condition) {
            message = message || "Assertion failed";
            if (typeof Error !== "undefined") {
                throw new Error(message);
            }
            throw message; // Fallback
        }
}

    // * Conkeror integration
    interactive("passwd-generate-and-save",
                "generates and saves a password for the provided username and domain",
                function (I) {
                    var username = passwd_manage_lastpass_username,
                        domain = "";
                    assertNotEmpty(username, 'username');
                    var lp = new LastPass(I, username);
                    domain = lp.get_current_domain();
                    debug(`asking user for domain, but providing ${domain} as default`);
                    domain = yield I.minibuffer.read($prompt = "domain: ", $initial_value=domain,
                                                     $select = true
                                                    );
                    if (!domain){
                        lp.echo_message("No domain specified - must specify a domain in order to create new entry");
                        return;
                    }

                    debug(`asking user for username, but providing ${username} as default`);
                    username = yield I.minibuffer.read($prompt = "username: ", $initial_value=username,
                                                       $select = true, $history = "passwd-usernames"
                                                      );
                    if (!username){
                        lp.echo_message("No username specified - must specify a username in order to create new entry");
                        return;
                    }
                    var completer = new all_word_completer(
                        $completions = [6,8,12,16,20].map(function(num){return num.toString();})
                    );
                    var length = 12;
                    debug(`asking user for length, but providing ${length} as default`);
                    length = yield I.minibuffer.read($prompt = "length",
                                                     $completer = completer,
                                                     $require_match = true,
                                                     $select = true,
                                                     $auto_complete_initial = true,
                                                     $initial_value = length,
                                                     $auto_complete = true
                                                    );
                    var symbols = yield I.minibuffer.read_yes_or_no($prompt = "include symbols? ", $initial_value='yes');

                    var password = yield lp.generate_and_save_password(domain, username, length, symbols);
                    debug(`CONFIDENTIAL: retrieved password ${password} from lastpass`);
                    setup_value_paster(I, password, 'password');
                    lp.echo_message(`Press ${passwd_manage_password_paste_key} to paste password into password field`);
                });

    function setup_value_paster(I, value, type, onSuccess=null){
        debug(`CONFIDENTIAL: initialising interactive function to paste ${type} ${value} into focused input HTML element`);
        if (!onSuccess){
            debug(`CONFIDENTIAL: no onSuccess provided, which means that we are finished after pasting ${value} one time`);
            onSuccess = function() {
                debug(`unbinding the passwd-set-value function, because we don't want passwords to be pasted by accident`);
                interactive(`passwd-set-value`,
                            "does nothing - no password set",
                            function() {}
                           );
            };
        }
        interactive(`passwd-set-value`,
                    `sets the current ${type} into the current field`,

                    function(I) {
                        if (I.buffer.focused_element){
                            debug(`CONFIDENTIAL: pasting value ${value} into the focused field`);
                            I.buffer.focused_element.value=value;
                        }
                        onSuccess();
                    });
        I.window.setTimeout(onSuccess, 30000);
    }

    interactive("passwd-get-username-and-password",
                `retrieves the username and password for given domain, sets 'passwd_manage_password_paste_key' to paste username and then password into focused fields`,
                function (I) {
                    debug(`retrieving username and password from password manager (LastPass)`);
                    var lp = new LastPass(I, passwd_manage_lastpass_username);
                    var domain = lp.get_current_domain();
                    domain = yield I.minibuffer.read($prompt = "domain search: ", $initial_value=domain,
                                                     $select = true
                                                    );
                    var id = yield lp.get_site_id_for_domain(domain);
                    debug(`after searching for domain ${domain}, found site with id ${id}`);
                    yield lp.set_login_and_password_fields(id);
                    debug(`tried to auto fill login and password fields - setting up paster for username and then password in case that failed`);
                    var ret = yield lp.get_username_and_password(id);
                    setup_value_paster(I, ret.username, 'username', function(){
                        debug(`now loading password into the one-shot paster`);
                        setup_value_paster(I, ret.password, 'password');
                        lp.echo_message(`Press ${passwd_manage_password_paste_key} to paste password into password field`);
                    });
                    lp.echo_message(`Press ${passwd_manage_password_paste_key} to paste username into username field`);
                });
    interactive("passwd-set-lastpass-username",
                "sets the default lastpass username",
                function (I) {
                    passwd_manage_lastpass_username = yield I.minibuffer.read($prompt = "enter LastPass username",
                                                                              $initial_value=passwd_manage_lastpass_username,
                                                                              $select = true);
                });

    define_key(content_buffer_text_keymap, passwd_manage_password_paste_key, `passwd-set-value`);
    // if (passwd_manage_setup_keybindings_p) {
    define_key(default_global_keymap, "C-t", "passwd-get-username-and-password");
    define_key(default_global_keymap, "C-x w", "passwd-generate-and-save");
    // }
    provide("conkeror-password-manage");
})();
