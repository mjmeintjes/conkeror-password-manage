require("conktest");

conktest_run("222 - Basic tests", {
    test_basic_test: function () {
        assert.equal(1, 4);
    },
    test_basic_test2: function () {
        assert.equal(1, 1);
    }
});

conktest_run("222 - Basic tests 2", {
    test_basic_test: function () {
        assert.equal(1, 4);
    },
    test_basic_test2: function () {
        assert.equal(1, 1);
    }
});
