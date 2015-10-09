require("chai");
provide("conktest");
var assert = chai.assert;
function conktest_results () {
    this.run = 0;
    this.failed = 0;
}
conkeror.tests = {};
dumpln('***********************************HOOOH***********************');
function run_all_tests(){
    dumpln("TESTING STARTING");
    dumpln("TAP version 13");
    var test_count = Object.keys(conkeror.tests).reduce(function(sum, suite_name) {
        var suite = tests[suite_name];
        var suite_tests = Object.keys(suite).filter((test) => test.startsWith("test_"));
        return sum + suite_tests.length;
    }, 0);
    dumpln(`1..${test_count}`);
    var results = {
        run: 0
    };
    try {
        Object.keys(conkeror.tests).forEach(function(name) {
            var suite = tests[name];
            if (suite.suite_setup)
                suite.suite_setup();
            for (var k in suite) {
                if (k.substr(0,5) == 'test_') {
                    if (suite.setup)
                        suite.setup();
                    results.run++;
                    var description = `${results.run} (${k})`;
                    try {
                        suite[k]();
                        dumpln(`ok ${description}`);
                    } catch (e) {
                        dumpln(`not ok ${description} - ${e.name}}`);
                            dumpln('  ---');
                        dumpln(`    message: "${e.message}"`);
                        dumpln(`    severity: "fail"`);
                        if (e.actual){
                            dumpln(`    expected: ${e.expected}`);
                            dumpln(`    actual: ${e.actual}`);
                        }
                        function stack_to_at(stack){
                            stack = stack.split('\n')[0];
                            stack = stack.split('>').slice(-1).pop();
                            return stack;
                        }
                        var stack_lines = e.stack.split('\n').map(function(line){
                            return line.split('>').slice(-1).pop().trim();
                        });
                        stack_lines = stack_lines.filter(function(line) {
                            return line.startsWith('file');
                        });
                        dumpln(`    at: - ${stack_lines.pop()}`);
                        stack_lines.forEach(function(line) {
                            dumpln(`        - ${line}`);
                        });
                        dumpln('  ...');
                        //dump_error(e);
                    }
                    if (suite.teardown)
                        suite.teardown();
                }
            }
            if (suite.suite_teardown)
                suite.suite_teardown();
            return results;
        });
    }
    finally {
        dumpln('TESTING FINISHED');
    }
};

function conktest_run (name, suite) {
    dumpln("*******************************RUNNING:" + name + "******************************");
    tests[name] = suite;
}
