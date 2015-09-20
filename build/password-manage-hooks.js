'use strict';

(function () {
    require('password-manage-utils');
    provide('password-manage-hooks');
    var password_manager_installers = [];
    var service_installers = [];
    var password_generators = {};
    var password_retrievers = {};

    conkeror.init_and_get_services = function (settings, I) {
        pmutils.debug('installing password managers and services using settings ' + pmutils.obj2str(settings));
        var services = get_password_manager_services(I);
        install_password_managers(settings, I, services);
        return services;
    };

    conkeror.register_password_manager_services = function (func) {
        service_installers.push(func);
    };

    conkeror.get_password_manager_services = function (I) {
        var services = {};
        service_installers.forEach(function (func) {
            func(services, I);
        });
        pmutils.debug('installed services');
        return services;
    };

    conkeror.register_password_manager_installer = function (func) {
        pmutils.debug('registering new password manager installer ' + func);
        password_manager_installers.push(func);
    };

    var install_password_managers = function install_password_managers(settings, I, services) {
        pmutils.debug('installing password managers using settings ' + pmutils.obj2str(settings));
        settings.forEach(function (args) {
            pmutils.debug('installing password manager for ' + pmutils.obj2str(args) + ' using registered password manager installers ' + password_manager_installers);
            password_manager_installers.forEach(function (func) {
                func(args, services);
            });
        });
    };

    conkeror.register_password_generator = function (name, func) {
        pmutils.debug('registering password generator ' + name);
        password_generators[name] = func;
    };

    conkeror.register_password_retriever = function (name, func) {
        pmutils.debug('registering password retriever ' + name);
        password_retrievers[name] = func;
    };

    conkeror.get_password_generators = function () {
        return Object.keys(password_generators);
    };
    conkeror.get_password_retrievers = function () {
        return Object.keys(password_retrievers);
    };

    conkeror.let_generator_generate_and_save_password = function (name, domain, username, length) {
        var include_symbols = arguments.length <= 4 || arguments[4] === undefined ? true : arguments[4];

        return password_generators[name](domain, username, length, include_symbols);
    };

    conkeror.let_retriever_get_username_and_password = regeneratorRuntime.mark(function callee$1$0(name, domain) {
        var fields, ret;
        return regeneratorRuntime.wrap(function callee$1$0$(context$2$0) {
            while (1) switch (context$2$0.prev = context$2$0.next) {
                case 0:
                    pmutils.debug('executing password_retriever: ' + password_retrievers[name]);
                    context$2$0.next = 3;
                    return password_retrievers[name](domain);

                case 3:
                    fields = context$2$0.sent;

                    pmutils.debug('found fields ' + pmutils.obj2str(fields));
                    ret = {};

                    Object.keys(fields).forEach(function (key) {
                        ret[key.toLowerCase()] = fields[key];
                    });
                    context$2$0.next = 9;
                    return co_return(ret);

                case 9:
                case 'end':
                    return context$2$0.stop();
            }
        }, callee$1$0, this);
    });
})();