(function(){
    // * Conkeror Password Manager
    define_variable("password_manage_generate_password_shortcut", "C-w x",
                    "Press to generate password for current site");
    define_variable("password_manage_password_paste_key", "C-t",
                    "Key to use to paste passwords and usernames into focused text boxes");
    define_variable("password_manage_lastpass_username", "",
                    "Default username to login to LastPass");
    define_variable("password_manage_setup_keybindings_p", true,
                    "NOT WORKING? - Whether to setup the default keybindings");
    define_variable("password_manage_debug_p", false,
                    "Enable debug mode. " +
                    "WARNING - this will print confidential material, like your passwords, to the console, and possible other logs!");
    define_variable("password_manage_settings", [],
                    "Register and enable different password managers");

    require('password-manage-utils');
    require('password-manage-hooks');
    require('password-manage-services');
    provide("conkeror-password-manage");

    pmutils.info(`loading passwd-manage module: provides functionality to use external password managers to retrieve and add passwords for Conkeror`);
    pmutils.info(`currently only supports LastPass (http://www.lastpass.com)`);

    // ** Public API / Conkeror integration
    interactive("passwd-generate-and-save",
                "generates and saves a password for the provided username and domain",
                generate_and_save);
    interactive("passwd-get-username-and-password",
                "retrieves the username and password for given domain, " +
                "sets 'password_manage_password_paste_key' to paste username and then password into focused fields",
                get_username_and_password);

    function* generate_and_save(I) {
        pmutils.info('starting to generate and save a new password');
        var username,
            domain = "",
            lengths = [6,8,12,16,20],
            length,
            symbols,
            password,
            generator_name,
            fields;
        var services = init_and_get_services(password_manage_settings, I);
        var browser = services.browser;
        var user = services.user;
        generator_name = yield ( select_password_manager(user, 'generator', get_password_generators()) );

        domain = browser.get_current_domain();
        domain = yield ( user.ask_if_different("domain: ", domain) );
        username = yield ( user.ask_if_different("username: ", username) );
        length = yield ( user.ask_to_select_number("length: ", 12, lengths) );
        symbols = yield ( I.minibuffer.read_yes_or_no($prompt = "include symbols? ", $initial_value='yes') );
        password = yield ( let_generator_generate_and_save_password(generator_name, domain, username, length, symbols) );

        pmutils.debug(`CONFIDENTIAL: retrieved password ${password} from ${generator_name}`);
        fields = {
            username: username,
            password: password
        };
        setup_paster(I, user, fields);
        browser.set_login_and_password_fields(domain, fields);
    }
    function* select_password_manager(user, type, options){
        if (!options.length) {
            throw new interactive_error(`no password ${type} registered`);
        }
        var manager_name = yield ( user.ask_to_select("password manager: ", options) );
        yield ( co_return(manager_name) );
    }

    function* get_username_and_password(I) {
        pmutils.debug(`retrieving username and password from password manager`);
        var services = init_and_get_services(password_manage_settings, I);
        var browser = services.browser;
        var user = services.user;
        var generator_name = yield ( select_password_manager(user, 'retriever', get_password_retrievers()) );
        var domain = browser.get_current_domain();
        domain = yield ( user.ask_if_different("domain: ", domain) );
        var fields = yield ( let_retriever_get_username_and_password(generator_name, domain) );
        browser.set_login_and_password_fields(fields.url || fields.URL || domain, fields);
        setup_paster(I, user, fields);
    }

    function setup_paster(I, user, fields){
        pmutils.debug(`setting up one shot pasters with fields ${pmutils.obj2str(fields)}`);
        function setup_password_paster(){
            setup_value_paster(I, fields.password, 'password');
            user.display_message(`Press ${password_manage_password_paste_key} to paste password into password field`);
        }
        if (fields.username){
            setup_value_paster(I, fields.username, 'username', function(){
                pmutils.debug(`now loading password into the one-shot paster`);
                setup_password_paster();
            });
            user.display_message(`Press ${password_manage_password_paste_key} to paste username into username field`);
        } else {
            pmutils.debug('no username supplied, only pasting password');
            setup_password_paster();
        }
    }
    function setup_value_paster(I, value, type, onSuccess=null){
        pmutils.debug(`CONFIDENTIAL: initialising interactive function to paste ${type} ${value} into focused input HTML element`);
        if (!onSuccess){
            pmutils.debug(`CONFIDENTIAL: no onSuccess provided, which means that we are finished after pasting ${value} one time`);
            onSuccess = function() {
                pmutils.debug(`unbinding the passwd-set-value function, because we don't want passwords to be pasted by accident`);
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
                            pmutils.debug(`CONFIDENTIAL: pasting value ${value} into the focused field`);
                            I.buffer.focused_element.value=value;
                        }
                        onSuccess();
                    });
        I.window.setTimeout(onSuccess, 30000);
    }

})();
