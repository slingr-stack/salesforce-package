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
step.apiCallSkeleton = function (inputs) {

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

	options= setApiUri(options);
	options= setRequestHeaders(options);

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

function setApiUri(options) {
	var API_URL = config.get("SKELETON_API_BASE_URL");
	var url = options.path || "";
	options.url = API_URL + url;
	sys.logs.debug('[skeleton] Set url: ' + options.path + "->" + options.url);
	return options;
}

function setRequestHeaders(options) {
	var headers = options.headers || {};

	sys.logs.debug('[skeleton] Set header Bearer');
	headers = mergeJSON(headers, {"Content-Type": "application/json"});
	headers = mergeJSON(headers, {"Authorization": "Bearer "+getAccessTokenForAccount()});

	if (headers.Accept === undefined || headers.Accept === null || headers.Accept === "") {
		sys.logs.debug('[skeleton] Set header accept');
		headers = mergeJSON(headers, {"Accept": "application/json"});
	}

	options.headers = headers;
	return options;
}

function getAccessTokenForAccount(account) {
	account = account || "account";
	sys.logs.info('[skeleton] Getting access token for account: '+account);
	var installationJson = sys.storage.get('installationInfo-Skeleton---'+account) || {id: null};
	var token = installationJson.token || null;
	var expiration = installationJson.expiration || 0;
	if (!token || expiration < new Date().getTime()) {
		sys.logs.info('[skeleton] Access token is expired or not found. Getting new token');
		var res = httpService.post(
			{
				url: "https://oauth2.googleapis.com/token",
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				body: {
					grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
					assertion: getJsonWebToken()
				}
			});
		token = res.access_token;
		var expires_at = res.expires_in;
		expiration = new Date(new Date(expires_at) - 1 * 60 * 1000).getTime();
		installationJson = mergeJSON(installationJson, {"token": token, "expiration": expiration});
		sys.logs.info('[skeleton] Saving new token for account: ' + account);
		sys.storage.replace('installationInfo-Skeleton---'+account, installationJson);
	}
	return token;
}

function getJsonWebToken() {
	var currentTime = new Date().getTime();
	var futureTime = new Date(currentTime + ( 10 * 60 * 1000)).getTime();
	var scopeProp= config.get("scope");
	var scopes;
	if (!!scopeProp) {
		scopes = scopeProp.map(function (s) {
			return "https://www.googleapis.com/auth/" + s;
		});
	}
	var scopesGlobal = scopes.join(" ");
	return sys.utils.crypto.jwt.generate(
		{
			iss: config.get("serviceAccountEmail"),
			aud: GOOGLEWORKSPACE_API_AUTH_URL,
			scope: scopesGlobal,
			iat: currentTime,
			exp: futureTime
		},
		config.get("privateKey"),
		"RS256"
	)
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
