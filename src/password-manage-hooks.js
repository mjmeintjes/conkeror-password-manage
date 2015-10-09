(function() {
    require('password-manage-utils');
    provide('password-manage-hooks');
    var password_manager_installers = [];
    var service_installers = [];
    var password_generators = {};
    var password_retrievers = {};

    conkeror.init_and_get_services = function(settings, I) {
        pmutils.debug(`installing password managers and services using settings ${pmutils.obj2str(settings)}`);
        var services = get_password_manager_services(I);
        install_password_managers(settings, I, services);
        return services;
    };

    conkeror.register_password_manager_services = function(func) {
        service_installers.push(func);
    };

    conkeror.get_password_manager_services = function(I) {
        var services = {};
        service_installers.forEach(function(func){
            func(services, I);
        });
        pmutils.debug(`installed services`);
        return services;
    };

    conkeror.register_password_manager_installer = function(func) {
        pmutils.debug(`registering new password manager installer ${func}`);
        password_manager_installers.push(func);
    };

    var install_password_managers = function(settings, I, services) {
        pmutils.debug(`installing password managers using settings ${pmutils.obj2str(settings)}`);
        settings.forEach(function(args){
            pmutils.debug(`installing password manager for ${pmutils.obj2str(args)} using registered password manager installers ${password_manager_installers}`);
            password_manager_installers.forEach(function(func){
                func(args, services);
            });
        });
    };

    conkeror.register_password_generator = function (name, func){
        pmutils.debug(`registering password generator ${name}`);
        password_generators[name] = func;
    };

    conkeror.register_password_retriever = function(name, func){
        pmutils.debug(`registering password retriever ${name}`);
        password_retrievers[name] = func;
    };

    conkeror.get_password_generators = function() {
        return Object.keys(password_generators);
    };
    conkeror.get_password_retrievers = function() {
        return Object.keys(password_retrievers);
    };

    conkeror.let_generator_generate_and_save_password = function(name, domain, username, length, include_symbols=true) {
        pmutils.debug(`generating and saving password for ${name}, from possible options ${password_generators}`);
        return password_generators[name](domain, username, length, include_symbols);
    };

    conkeror.let_retriever_get_username_and_password = function(name, domain) {
        pmutils.debug(`executing password_retriever: ${password_retrievers[name]}`);
        var fields = yield ( password_retrievers[name](domain) );
        pmutils.debug(`found fields ${pmutils.obj2str(fields)}`);
        var ret = {};
        Object.keys(fields).forEach(function(key) {
            ret[key.toLowerCase()] = fields[key];
        });
        yield ( co_return(ret) );
    };

})();
