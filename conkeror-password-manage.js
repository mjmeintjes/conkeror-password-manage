(function(){
    // * Conkeror Password Manager
    require('password-manage-utils');
    install_password_manage_utils(this);
    require('password-manage-hooks');
    require('password-manage-services');

    utils.info(`loading passwd-manage module: provides functionality to use external password managers to retrieve and add passwords for Conkeror`);
    utils.info(`currently only supports LastPass (http://www.lastpass.com)`);

    define_variable("passwd_manage_lastpass_username", "",
                    "Default username to login to LastPass");
    define_variable("passwd_manage_setup_keybindings_p", true,
                    "NOT WORKING? - Whether to setup the default keybindings");
    define_variable("passwd_manage_password_paste_key", "C-j",
                    "Key to use to paste passwords and usernames into focused text boxes");
    define_variable("passwd_manage_debug_p", false,
                    "Enable debug mode. " +
                    "WARNING - this will print confidential material, like your passwords, to the console, and possible other logs!");
    define_variable("password_manage_settings", [],
                    "Register and enable different password managers");
    // ** Public API / Conkeror integration
    interactive("passwd-generate-and-save",
                "generates and saves a password for the provided username and domain",
                generate_and_save);
    interactive("passwd-get-username-and-password",
                "retrieves the username and password for given domain, " +
                "sets 'passwd_manage_password_paste_key' to paste username and then password into focused fields",
                get_username_and_password);
    interactive("passwd-set-lastpass-username",
                "sets the default lastpass username",
                set_lastpass_username);

    define_key(content_buffer_text_keymap, passwd_manage_password_paste_key, `passwd-set-value`);
    define_key(default_global_keymap, "C-t", "passwd-get-username-and-password");
    define_key(default_global_keymap, "C-x w", "passwd-generate-and-save");
    provide("conkeror-password-manage");


    // ** Implementation
    function set_lastpass_username(I) {
        passwd_manage_lastpass_username = yield I.minibuffer.read($prompt = "enter LastPass username",
                                                                  $initial_value=passwd_manage_lastpass_username,
                                                                  $select = true);
    }

    require('password-manage-lastpass');
    require('password-manage-pass');
    function generate_and_save(I) {
        utils.info('starting to generate and save a new password');
        var username = passwd_manage_lastpass_username,
            domain = "",
            lengths = [6,8,12,16,20],
            length,
            symbols,
            password,
            generator_name,
            fields;
        var services = init_and_get_services(password_manage_settings, I);
        var browser = services.browser
;
        var user = services.user;
        var generators = get_password_generators();
        if (!generators.length) {
            throw new interactive_error('no password generators registered');
        }
        generator_name = yield user.ask_to_select("password manager: ", generators);

        domain = browser.get_current_domain();
        domain = yield user.ask_if_different("domain: ", domain);
        username = yield user.ask_if_different("username: ", username);
        length = yield user.ask_to_select_number("length: ", 12, lengths);
        symbols = yield I.minibuffer.read_yes_or_no($prompt = "include symbols? ", $initial_value='yes');
        password = yield let_generator_generate_and_save_password(generator_name, domain, username, length, symbols);

        utils.debug(`CONFIDENTIAL: retrieved password ${password} from ${generator_name}`);
        fields = {
            username: username,
            password: password
        };
        setup_paster(I, user, fields);
        browser.set_login_and_password_fields(domain, fields);
    }

    function get_username_and_password(I) {
        utils.debug(`retrieving username and password from password manager (LastPass)`);
        var user = new UserInteraction(I);
        var browser = new BrowserInteraction(I);
        var lp = new LastPass(user, browser, passwd_manage_lastpass_username);
        var domain = browser.get_current_domain();
        domain = yield I.minibuffer.read($prompt = "domain search: ", $initial_value=domain,
                                         $select = true
                                        );
        var id = yield lp.get_site_id_for_domain(domain);
        utils.debug(`after searching for domain ${domain}, found site with id ${id}`);
        yield lp.set_login_and_password_fields(id);
        utils.debug(`tried to auto fill login and password fields - setting up paster for username and then password in case that failed`);
        var fields = yield lp.get_username_and_password(id);
        setup_paster(I, user, fields);
    }

    function setup_paster(I, user, fields){
        function setup_password_paster(){
            setup_value_paster(I, fields.password, 'password');
            user.display_message(`Press ${passwd_manage_password_paste_key} to paste password into password field`);
        }
        if (fields.username){
            setup_value_paster(I, fields.username, 'username', function(){
                utils.debug(`now loading password into the one-shot paster`);
                setup_password_paster();
            });
            user.display_message(`Press ${passwd_manage_password_paste_key} to paste username into username field`);
        } else {
            setup_password_paster();
        }
    }
    function setup_value_paster(I, value, type, onSuccess=null){
        utils.debug(`CONFIDENTIAL: initialising interactive function to paste ${type} ${value} into focused input HTML element`);
        if (!onSuccess){
            utils.debug(`CONFIDENTIAL: no onSuccess provided, which means that we are finished after pasting ${value} one time`);
            onSuccess = function() {
                utils.debug(`unbinding the passwd-set-value function, because we don't want passwords to be pasted by accident`);
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
                            utils.debug(`CONFIDENTIAL: pasting value ${value} into the focused field`);
                            I.buffer.focused_element.value=value;
                        }
                        onSuccess();
                    });
        I.window.setTimeout(onSuccess, 30000);
    }

})();
