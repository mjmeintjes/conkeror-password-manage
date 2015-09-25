require("chai");
provide("conktest");
var assert = chai.assert;
function conktest_results () {
    this.run = 0;
    this.failed = 0;
}

function conktest_run (suite) {
    dumpln("TESTING STARTING");
    dumpln("*******************************RUNNING:" + suite.name + "******************************");
    try{
        var results = new conktest_results();
        if (suite.suite_setup)
            suite.suite_setup();
        for (var k in suite) {
            if (k.substr(0,5) == 'test_') {
                if (suite.setup)
                    suite.setup();
                results.run++;
                dump(k+'..');
                try {
                    suite[k]();
                    dumpln('ok');
                } catch (e) {
                    results.failed++;
                    dumpln('failed');
                    dumpln("----------------------------------------------------");
                    dump_error(e);
                    dumpln("====================================================");
                }
                if (suite.teardown)
                    suite.teardown();
            }
        }
        if (suite.suite_teardown)
            suite.suite_teardown();
        dumpln("TEST RESULTS FOR \"" + suite.name + "\": " + results.run+" run, "+results.failed+" failed");
        dumpln("");
        dumpln("");
        return results;
    }
    finally {
        dumpln("TESTING FINISHED");
    }
}
