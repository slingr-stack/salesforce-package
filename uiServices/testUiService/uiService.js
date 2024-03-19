service.testFunction = function (message) {
    console.log('test function arrived ',message);
    service.callback(message, 'callbackTest');
};