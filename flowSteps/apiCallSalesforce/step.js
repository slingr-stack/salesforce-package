/****************************************************
 Dependencies
 ****************************************************/

var httpService = dependencies.http;

/**
 * This flow step will send generic request.
 *
 * @param {object} inputs
 * {text} method, This is used to config method.
 * {text} url, This is used to config external URL.
 * {Array[string]} pathVariables, This is used to config path variables.
 * {Array[string]} headers, This is used to config headers.
 * {Array[string]} params, This is used to config params.
 * {string} body, This is used to send body request.
 * {boolean} followRedirects, This is used to config follow redirects.
 * {boolean} download, This is used to config download.
 * {boolean} fullResponse, This is used to config full response.
 * {number} connectionTimeout, Read timeout interval, in milliseconds.
 * {number} readTimeout, Connect timeout interval, in milliseconds.
 */
step.apiCallSalesforce = function (inputs) {

	var inputsLogic = {
		headers: inputs.headers || [],
		params: inputs.params || [],
		body: inputs.body || {},
		followRedirects: inputs.followRedirects || false,
		download: inputs.download || false,
		fileName: inputs.fileName || "",
		fullResponse: inputs.fullResponse || false,
		connectionTimeout: inputs.connectionTimeout || 5000,
		readTimeout: inputs.readTimeout || 60000,
		path: inputs.path || {
			urlValue: "",
			paramsValue: []
		},
		method: inputs.method || "get",
	};

	inputsLogic.headers = isObject(inputsLogic.headers) ? inputsLogic.headers : stringToObject(inputsLogic.headers);
	inputsLogic.params = isObject(inputsLogic.params) ? inputsLogic.params : stringToObject(inputsLogic.params);
	inputsLogic.body = isObject(inputsLogic.body) ? inputsLogic.body : JSON.parse(inputsLogic.body);

	var options = {
		path: parse(inputsLogic.path.urlValue, inputsLogic.path.paramsValue),
		params: inputsLogic.params,
		headers: inputsLogic.headers,
		body: inputsLogic.body,
		followRedirects : inputsLogic.followRedirects,
		forceDownload :inputsLogic.download,
		downloadSync : false,
		fileName: inputsLogic.fileName,
		fullResponse : inputsLogic.fullResponse,
		connectionTimeout: inputsLogic.connectionTimeout,
		readTimeout: inputsLogic.readTimeout
	}

	methodOnInit();

	options= setApiUri(options);
	options= setRequestHeaders(options);
	options= setAuthorization(options);

	switch (inputsLogic.method.toLowerCase()) {
		case 'get':
			return httpService.get(options);
		case 'post':
			return httpService.post(options);
		case 'delete':
			return httpService.delete(options);
		case 'put':
			return httpService.put(options);
		case 'connect':
			return httpService.connect(options);
		case 'head':
			return httpService.head(options);
		case 'options':
			return httpService.options(options);
		case 'patch':
			return httpService.patch(options);
		case 'trace':
			return httpService.trace(options);
	}

	return null;
};

function parse (url, pathVariables){
	var regex = /{([^}]*)}/g;
	if (!url.match(regex)){
		return url;
	}
	if(!pathVariables){
		sys.logs.error('No path variables have been received and the url contains curly brackets\'{}\'');
		throw new Error('Error please contact support.');
	}
	url = url.replace(regex, function(m, i) {
		return pathVariables[i] ? pathVariables[i] : m;
	})
	return url;
}

function isObject (obj) {
	return !!obj && stringType(obj) === '[object Object]'
}

var stringType = Function.prototype.call.bind(Object.prototype.toString);

function stringToObject (obj) {
	if (!!obj){
		var keyValue = obj.toString().split(',');
		var parseObj = {};
		for(var i = 0; i < keyValue.length; i++) {
			parseObj[keyValue[i].split('=')[0]] = keyValue[i].split('=')[1]
		}
		return parseObj;
	}
	return null;
}


function methodOnInit(){
	var refreshTokenResponse;
	if (config.get("authorizationMethod") === 'webServer') {
		var authorizationCodeFromStorage = sys.storage.get('authorizationCode-Salesforce', {decrypt:true});
		if (authorizationCodeFromStorage === undefined) {
			refreshTokenResponse = httpService.post({
				url: config.get("instanceUrl") + '/services/oauth2/token',
				headers: {
					"Accept": "application/json",
					"Content-Type": "application/x-www-form-urlencoded"
				},
				body: {"grant_type": "authorization_code", "code": config.get("code"), "redirect_uri": config.get("redirectUri")}
			});
		} else {
			refreshTokenResponse = httpService.post({
				url: config.get("instanceUrl") + '/services/oauth2/token',
				headers: {
					"Accept": "application/json",
					"Content-Type": "application/x-www-form-urlencoded"
				},
				body: {"grant_type": "refresh_token", "refresh_token": authorizationCodeFromStorage}
			});
		}
	}
	if (config.get("authorizationMethod") === 'usernamePassword') {
		refreshTokenResponse = httpService.post({
			url: config.get("instanceUrl") + '/services/oauth2/token',
			headers: {
				"Accept": "application/json",
				"Content-Type": "application/x-www-form-urlencoded"
			},
			body: {"grant_type": "password", "username": config.get("userName"), "password": config.get("password")}
		});
	}
	sys.logs.debug('[salesforce] Refresh token response: ' + JSON.stringify(refreshTokenResponse));
	if (!!refreshTokenResponse && !!refreshTokenResponse.data && !!refreshTokenResponse.data.refresh_token) {
		sys.storage.put('authorizationCode-Salesforce', refreshTokenResponse.data.refresh_token, {encrypt:true});
	}
	if (!!refreshTokenResponse && !!refreshTokenResponse.data && !!refreshTokenResponse.data.access_token) {
		sys.storage.put('accessToken-Salesforce', refreshTokenResponse.data.access_token, {encrypt:true});
	}
}

function setApiUri(options) {
	var url = options.path || "";
	var API_URL = config.get("instanceUrl");
	options.url = API_URL + url;
	sys.logs.debug('[salesforce] Set url: ' + options.path + "->" + options.url);
	return options;
}

function setRequestHeaders(options) {
	var headers = options.headers || {};

	headers = mergeJSON(headers, {"Content-Type": "application/json"});

	options.headers = headers;
	return options;
}

function setAuthorization(options) {
	sys.logs.debug('[salesforce] Setting header token oauth');
	var authorization = options.authorization || {};
	authorization = mergeJSON(authorization, {
		type: "oauth2",
		accessToken: sys.storage.get('accessToken-Salesforce', refreshTokenResponse.data.access_token, {decrypt:true}),
		headerPrefix: "Bearer"
	});
	options.authorization = authorization;
	return options;
}

function mergeJSON (json1, json2) {
	var result = {};
	var key;
	for (key in json1) {
		if(json1.hasOwnProperty(key)) result[key] = json1[key];
	}
	for (key in json2) {
		if(json2.hasOwnProperty(key)) result[key] = json2[key];
	}
	return result;
}
