(function() {
    require('password-manage-utils');
    install_password_manage_utils(this);
    require('password-manage-hooks');
    provide('password-manage-services');
    function register_services(services, I) {
        services.user = new UserInteraction(I);
        services.browser = new BrowserInteraction(I);
        services.shell = new ShellInteraction();
    }
    register_password_manager_services(register_services);

    var UserInteraction = function(I) {
        this.I = I;
    };

    UserInteraction.prototype.ask = function(question, _args={}) {
        var keys = Object.keys(_args);
        var args = {};
        keys.forEach(function(key) {
            args["$" + key] = _args[key];
        });

        args._processed_keywords = true;
        utils.debug(`display prompt '${question}' with parameters ${args}`);
        var answer = yield this.I.minibuffer.read($prompt = question,
                                                  forward_keywords(args));

        utils.debug(`user answered with ${answer}`);
        yield co_return(answer);
    };

    UserInteraction.prototype.ask_if_different = function(question, current) {
        utils.debug(`asking user ${question} but supplying default ${current}`);
        var answer = yield this.ask(question, {
            initial_value: current,
            select: true,
            history: `passwdmanage-${question}`
        });
        yield co_return(answer);
    };

    require('minibuffer');
    UserInteraction.prototype.ask_for_password = function(question, _args={}) {
        //todo: make passwords hidden when typing in
        var I = this.I;
        var input = this.I.minibuffer.input_element;
        var old_type = input.inputField.type;
        try{
            input.inputField.type = 'password';
            var answer = yield this.ask(question, _args);
            yield co_return(answer);
        }
        finally {
            input.inputField.type = old_type;
        }
    };

    UserInteraction.prototype.ask_to_select_number = function(question, preselected, numbers) {
        numbers = numbers.map(function(num){return num.toString();});
        var selected = yield this.ask_to_select(question, numbers, preselected);
        yield co_return(selected);
    };
    UserInteraction.prototype.ask_to_select = function(question, options, default_option=null) {
        if (!default_option){
            default_option = options[0];
        }
        utils.debug(`asking user to select from ${options}, and providing ${default_option} as default`);
        var answer = yield this.ask(question, {
            completer:  new all_word_completer($completions = options),
            require_match:  true,
            initial_value: default_option,
            select:  true,
            default_completion:  default_option,
            auto_complete_initial:  default_option,
            auto_complete:  true
        });
        yield co_return(answer);
    };

    UserInteraction.prototype.display_message = function(message) {
        var window = this.I.window;
        utils.debug(`displaying following message to user: ${message}`);
        window.minibuffer.message(message);
    };


    var BrowserInteraction = function(I) {
        this.I = I;
    };

    BrowserInteraction.prototype.set_login_and_password_fields = function(password_domain, fields){
        var I = this.I;
        var document = I.buffer.document;
        utils.assertNotEmpty(password_domain, 'password_domain');
        utils.assertNotEmpty(fields, 'fields');
        utils.debug(`trying to set login and password fields in HTML using fields ${fields}`);

        var current_domain = this.get_current_domain();
        if (this.get_hostname(password_domain) !== current_domain){
            throw new interactive_error("cannot set fields because current domain does not match the domain set for the password");
        }
        // TODO insert filter to only fill fields on the matching url to prevent phising attempts - similar to how LastPass extension does it
        // TODO set password on any found input fields with type=password
        // TODO set username on common username fields (extract from my current LastPass)

        Object.keys(fields).forEach(function(key){
            utils.debug(`CONFIDENTIDAL: setting value for field ${fields[key]}`);
            var val = fields[key];

            var el = [document.getElementById(key)];
            if (!el.length)
                el = document.getElementsByName(key);
            if (!el.length)
                el = document.getElementsByClassName(key);

            el = el[0];
            if (!el){
                utils.debug(`could not find a field named ${key} - not setting anything for this field`);
                return;
            }
            el.value = val;
        });
    };

    BrowserInteraction.prototype.get_current_domain = function(){
        var I = this.I;
        var current_url = I.buffer.document.location.href;
        return this.get_hostname(current_url);
    };

    BrowserInteraction.prototype.get_hostname = function(url){
        var I = this.I;
        utils.debug(`retrieving current domain (uses a slow hack, but it works and not too worried about performance)`);
        var tmp_a = I.buffer.document.createElement('a');
        tmp_a.href = url;
        var domain = tmp_a.hostname;
        utils.debug(`extracted ${domain} hostname from url ${url}`);
        return domain;
    };

    var ShellInteraction = function() {
    };

    ShellInteraction.prototype.get_command = function(command, input) {
        var results = {
            data: "",
            error: ""
        };
        var communication = {
            0: { output: async_binary_string_writer(input) },
            1: { input: async_binary_reader(function (s) results.data+=s||"") },
            2: { input: async_binary_reader(function (s) results.error+=s||"") }
        };
        var result = yield shell_command(command,
                                         $fds = communication);
        results.return_code = result;
        results.data = results.data.trim();
        utils.debug(`received the following results from running the command: ${JSON.stringify(results)}`);
        yield co_return(results);
    };
})();
