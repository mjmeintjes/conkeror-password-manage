require('conktest');
//require("password-manage-services.js");
/*
describe('UserInteraction', function() {
    var I = {};
    I.minibuffer = {};
    conkeror.$prompt = 'keyword';
    conkeror.forward_keywords = function(args){return args;};
    var service = get_password_manager_services(I);

    it('should prompt user with supplied question', function() {
        I.minibuffer.read = sinon.spy();
        var user = service.user;
        user.ask('question', {}).next();
        sinon.assert.calledOnce(I.minibuffer.read);
        assert.equal('question', I.minibuffer.read.getCall(0).args[0]);
    });
    it('should prompt user with supplied arguments', function() {
        I.minibuffer.read = sinon.spy();
        var user = service.user;
        var args = {
            arg1: 1,
            arg2: 2
        };
        user.ask('question', args).next();
        sinon.assert.calledOnce(I.minibuffer.read);
        var calledArgs = I.minibuffer.read.getCall(0).args[1];

        assert.equal(args.arg1, calledArgs.$arg1);
        assert.equal(args.arg2, calledArgs.$arg2);
    });
});
 */
global = conkeror;
dumpln("*********************************START***********************");
describe("TEST", function() {
    dumpln("*********************************TEST***********************");
    it('test1', function(){
        dumpln("*********************************TESTINGfd fs p***********************");
        assert.equal(1, 4);
    });
});
dumpln("*********************************FINISHED***********************");
var mocha = new Mocha({
    ui: 'tdd',
    reporter: 'list'
});
mocha.run();


