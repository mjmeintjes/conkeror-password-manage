'use strict';

(function () {
    require('password-manage-utils');
    require('password-manage-hooks');
    provide('password-manage-services');
    function register_services(services, I) {
        services.user = new UserInteraction(I);
        services.browser = new BrowserInteraction(I);
        services.shell = new ShellInteraction();
    }
    register_password_manager_services(register_services);

    var UserInteraction = function UserInteraction(I) {
        this.I = I;
    };

    UserInteraction.prototype.ask = regeneratorRuntime.mark(function callee$1$0(question) {
        var _args = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

        var keys, args, answer;
        return regeneratorRuntime.wrap(function callee$1$0$(context$2$0) {
            while (1) switch (context$2$0.prev = context$2$0.next) {
                case 0:
                    keys = Object.keys(_args);
                    args = {};

                    keys.forEach(function (key) {
                        args["$" + key] = _args[key];
                    });

                    args._processed_keywords = true;
                    pmutils.debug('display prompt \'' + question + '\' with parameters ' + args);
                    context$2$0.next = 7;
                    return this.I.minibuffer.read($prompt = question, forward_keywords(args));

                case 7:
                    answer = context$2$0.sent;

                    pmutils.debug('user answered with ' + answer);
                    context$2$0.next = 11;
                    return co_return(answer);

                case 11:
                case 'end':
                    return context$2$0.stop();
            }
        }, callee$1$0, this);
    });

    UserInteraction.prototype.ask_if_different = regeneratorRuntime.mark(function callee$1$0(question, current) {
        var answer;
        return regeneratorRuntime.wrap(function callee$1$0$(context$2$0) {
            while (1) switch (context$2$0.prev = context$2$0.next) {
                case 0:
                    pmutils.debug('asking user ' + question + ' but supplying default ' + current);
                    context$2$0.next = 3;
                    return this.ask(question, { initial_value: current, select: true, history: 'passwdmanage-' + question });

                case 3:
                    answer = context$2$0.sent;
                    context$2$0.next = 6;
                    return co_return(answer);

                case 6:
                case 'end':
                    return context$2$0.stop();
            }
        }, callee$1$0, this);
    });

    UserInteraction.prototype.ask_for_password = regeneratorRuntime.mark(function callee$1$0(question) {
        var _args = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

        var I, input, old_type, answer;
        return regeneratorRuntime.wrap(function callee$1$0$(context$2$0) {
            while (1) switch (context$2$0.prev = context$2$0.next) {
                case 0:
                    I = this.I;
                    input = this.I.minibuffer.input_element;
                    old_type = input.inputField.type;
                    context$2$0.prev = 3;

                    input.inputField.type = 'password';
                    context$2$0.next = 7;
                    return this.ask(question, _args);

                case 7:
                    answer = context$2$0.sent;
                    context$2$0.next = 10;
                    return co_return(answer);

                case 10:
                    context$2$0.prev = 10;

                    input.inputField.type = old_type;
                    return context$2$0.finish(10);

                case 13:
                case 'end':
                    return context$2$0.stop();
            }
        }, callee$1$0, this, [[3,, 10, 13]]);
    });

    UserInteraction.prototype.ask_to_select_number = regeneratorRuntime.mark(function callee$1$0(question, preselected, numbers) {
        var selected;
        return regeneratorRuntime.wrap(function callee$1$0$(context$2$0) {
            while (1) switch (context$2$0.prev = context$2$0.next) {
                case 0:
                    numbers = numbers.map(function (num) {
                        return num.toString();
                    });
                    context$2$0.next = 3;
                    return this.ask_to_select(question, numbers, preselected);

                case 3:
                    selected = context$2$0.sent;
                    context$2$0.next = 6;
                    return co_return(selected);

                case 6:
                case 'end':
                    return context$2$0.stop();
            }
        }, callee$1$0, this);
    });
    UserInteraction.prototype.ask_to_select = regeneratorRuntime.mark(function callee$1$0(question, options) {
        var default_option = arguments.length <= 2 || arguments[2] === undefined ? null : arguments[2];
        var answer;
        return regeneratorRuntime.wrap(function callee$1$0$(context$2$0) {
            while (1) switch (context$2$0.prev = context$2$0.next) {
                case 0:
                    pmutils.assertNotEmpty(options, 'options');
                    pmutils.assertNotEmpty(question, 'question');

                    if (options.length) {
                        context$2$0.next = 4;
                        break;
                    }

                    throw new interactive_error('no options found');

                case 4:
                    if (!default_option) {
                        default_option = options[0];
                    }
                    pmutils.debug('asking user to select from ' + options + ', and providing ' + default_option + ' as default');
                    context$2$0.next = 8;
                    return this.ask(question, {
                        completer: new all_word_completer($completions = options),
                        require_match: true,
                        initial_value: default_option,
                        select: true,
                        default_completion: default_option,
                        auto_complete_initial: default_option,
                        auto_complete: true
                    });

                case 8:
                    answer = context$2$0.sent;
                    context$2$0.next = 11;
                    return co_return(answer);

                case 11:
                case 'end':
                    return context$2$0.stop();
            }
        }, callee$1$0, this);
    });

    UserInteraction.prototype.display_message = function (message) {
        var window = this.I.window;
        pmutils.debug('displaying following message to user: ' + message);
        window.minibuffer.message(message);
    };

    var BrowserInteraction = function BrowserInteraction(I) {
        this.I = I;
    };

    BrowserInteraction.prototype.set_login_and_password_fields = function (password_domain, fields) {
        var I = this.I;
        var document = I.buffer.document;
        pmutils.assertNotEmpty(password_domain, 'password_domain');
        pmutils.assertNotEmpty(fields, 'fields');
        pmutils.debug('trying to set login and password fields in HTML using fields ' + pmutils.obj2str(fields));
        pmutils.assertNotEmpty(fields.password, 'password');

        var current_domain = this.get_current_domain();
        if (this.get_hostname(password_domain) !== current_domain) {
            throw new interactive_error("cannot set fields because current domain does not match the domain set for the password");
        }
        var password_elements = I.buffer.document.querySelectorAll("input[type=password]");
        if (password_elements.length) {
            pmutils.debug('setting field ' + password_elements[0] + ' to ' + fields.password);
            password_elements[0].value = fields.password;
        }
        // TODO set username on common username fields (extract from my current LastPass)

        Object.keys(fields).forEach(function (key) {
            pmutils.debug('CONFIDENTIDAL: setting value for field ' + fields[key]);
            var val = fields[key];

            var el = [document.getElementById(key)];
            if (!el.length) el = document.getElementsByName(key);
            if (!el.length) el = document.getElementsByClassName(key);

            el = el[0];
            if (!el) {
                pmutils.debug('could not find a field named ' + key + ' - not setting anything for this field');
                return;
            }
            el.value = val;
        });
    };

    BrowserInteraction.prototype.get_current_domain = function () {
        var I = this.I;
        var current_url = I.buffer.document.location.href;
        return this.get_hostname(current_url);
    };

    BrowserInteraction.prototype.get_hostname = function (url) {
        var I = this.I;
        pmutils.debug('retrieving current domain (uses a slow hack, but it works and not too worried about performance)');
        var tmp_a = I.buffer.document.createElement('a');
        tmp_a.href = url;
        var domain = tmp_a.hostname;
        pmutils.debug('extracted ' + domain + ' hostname from url ' + url);
        return domain;
    };

    var ShellInteraction = function ShellInteraction() {};

    ShellInteraction.prototype.get_command = regeneratorRuntime.mark(function callee$1$0(command, input) {
        var results, communication, result;
        return regeneratorRuntime.wrap(function callee$1$0$(context$2$0) {
            while (1) switch (context$2$0.prev = context$2$0.next) {
                case 0:
                    results = {
                        data: "",
                        error: ""
                    };
                    communication = {
                        0: { output: async_binary_string_writer(input) },
                        1: { input: async_binary_reader(function (s) {
                                return results.data += s || "";
                            }) },
                        2: { input: async_binary_reader(function (s) {
                                return results.error += s || "";
                            }) }
                    };
                    context$2$0.next = 4;
                    return shell_command(command, $fds = communication);

                case 4:
                    result = context$2$0.sent;

                    results.return_code = result;
                    results.data = results.data.trim();
                    pmutils.debug('received the following results from running the command: ' + JSON.stringify(results));
                    context$2$0.next = 10;
                    return co_return(results);

                case 10:
                case 'end':
                    return context$2$0.stop();
            }
        }, callee$1$0, this);
    });
})();

//todo: make passwords hidden when typing in