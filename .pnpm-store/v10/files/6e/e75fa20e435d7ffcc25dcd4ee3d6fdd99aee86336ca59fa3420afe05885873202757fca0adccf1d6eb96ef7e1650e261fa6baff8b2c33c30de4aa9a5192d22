import { version } from "./package-Beb-iarE.js";
import { logDeprecationWarning } from "./deprecations-pLmw6Ytd.js";
import { ActionType, CallbackResultResponse, MetadataFetchResponse, MetadataFetchStreamPart, UploadActionPayload, UploadThingHook, UploadThingToken$1 as UploadThingToken, UploadedFileData$1 as UploadedFileData } from "./shared-schemas-BIFDoqPF.js";
import { InvalidRouteConfigError, UploadThingError, bytesToFileSize, fileSizeToBytes, fillInputRouteConfig, filterDefinedObjectValues, generateKey, generateSignedURL, getStatusCodeFromError, matchFileType, objectKeys, verifySignature } from "@uploadthing/shared";
import * as Effect$4 from "effect/Effect";
import * as Effect$3 from "effect/Effect";
import * as Effect$2 from "effect/Effect";
import * as Effect$1 from "effect/Effect";
import * as Effect from "effect/Effect";
import * as HttpApp from "@effect/platform/HttpApp";
import * as HttpBody from "@effect/platform/HttpBody";
import * as HttpClient from "@effect/platform/HttpClient";
import * as HttpClientRequest from "@effect/platform/HttpClientRequest";
import * as HttpClientResponse from "@effect/platform/HttpClientResponse";
import * as HttpRouter from "@effect/platform/HttpRouter";
import * as HttpServerRequest from "@effect/platform/HttpServerRequest";
import * as HttpServerResponse from "@effect/platform/HttpServerResponse";
import * as Config$2 from "effect/Config";
import * as Config$1 from "effect/Config";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Match from "effect/Match";
import * as Redacted from "effect/Redacted";
import * as S$1 from "effect/Schema";
import * as S from "effect/Schema";
import * as Schema$2 from "effect/Schema";
import * as Schema$1 from "effect/Schema";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Stream from "effect/Stream";
import * as ConfigError from "effect/ConfigError";
import * as Either$1 from "effect/Either";
import * as Layer$1 from "effect/Layer";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as LogLevel from "effect/LogLevel";
import * as Cause from "effect/Cause";
import * as Data$1 from "effect/Data";
import * as Data from "effect/Data";
import * as Runtime from "effect/Runtime";
import * as FetchHttpClient from "@effect/platform/FetchHttpClient";
import * as Headers from "@effect/platform/Headers";
import * as FiberRef from "effect/FiberRef";
import * as ManagedRuntime from "effect/ManagedRuntime";

//#region src/_internal/config.ts
/**
* Merge in `import.meta.env` to the built-in `process.env` provider
* Prefix keys with `UPLOADTHING_` so we can reference just the name.
* @example
* process.env.UPLOADTHING_TOKEN = "foo"
* Config.string("token"); // Config<"foo">
*/
const envProvider = ConfigProvider.fromEnv().pipe(ConfigProvider.orElse(() => ConfigProvider.fromMap(new Map(Object.entries(filterDefinedObjectValues(import.meta?.env ?? {}))), { pathDelim: "_" })), ConfigProvider.nested("uploadthing"), ConfigProvider.constantCase);
/**
* Config provider that merges the options from the object
* and environment variables prefixed with `UPLOADTHING_`.
* @remarks Options take precedence over environment variables.
*/
const configProvider = (options) => ConfigProvider.fromJson(options ?? {}).pipe(ConfigProvider.orElse(() => envProvider));
const IsDevelopment = Config$2.boolean("isDev").pipe(Config$2.orElse(() => Config$2.succeed(typeof process !== "undefined" ? process.env.NODE_ENV : void 0).pipe(Config$2.map((_) => _ === "development"))), Config$2.withDefault(false));
const UTToken = S$1.Config("token", UploadThingToken).pipe(Effect$4.catchTags({ ConfigError: (e) => new UploadThingError({
	code: e._op === "InvalidData" ? "INVALID_SERVER_CONFIG" : "MISSING_ENV",
	message: e._op === "InvalidData" ? "Invalid token. A token is a base64 encoded JSON object matching { apiKey: string, appId: string, regions: string[] }." : "Missing token. Please set the `UPLOADTHING_TOKEN` environment variable or provide a token manually through config.",
	cause: e
}) }));
const ApiUrl = Config$2.string("apiUrl").pipe(Config$2.withDefault("https://api.uploadthing.com"), Config$2.mapAttempt((_) => new URL(_)), Config$2.map((url) => url.href.replace(/\/$/, "")));
const IngestUrl = Effect$4.fn(function* (preferredRegion) {
	const { regions, ingestHost } = yield* UTToken;
	const region = preferredRegion ? regions.find((r) => r === preferredRegion) ?? regions[0] : regions[0];
	return yield* Config$2.string("ingestUrl").pipe(Config$2.withDefault(`https://${region}.${ingestHost}`), Config$2.mapAttempt((_) => new URL(_)), Config$2.map((url) => url.href.replace(/\/$/, "")));
});
const UtfsHost = Config$2.string("utfsHost").pipe(Config$2.withDefault("utfs.io"));
const UfsHost = Config$2.string("ufsHost").pipe(Config$2.withDefault("ufs.sh"));
const UfsAppIdLocation = Config$2.literal("subdomain", "path")("ufsAppIdLocation").pipe(Config$2.withDefault("subdomain"));

//#endregion
//#region src/_internal/error-formatter.ts
function defaultErrorFormatter(error) {
	return { message: error.message };
}
function formatError(error, router) {
	const firstSlug = Object.keys(router)[0];
	const errorFormatter = firstSlug ? router[firstSlug]?.errorFormatter ?? defaultErrorFormatter : defaultErrorFormatter;
	return errorFormatter(error);
}

//#endregion
//#region src/_internal/jsonl.ts
const handleJsonLineStream = (schema, onChunk) => (stream) => {
	let buf = "";
	return stream.pipe(Stream.decodeText(), Stream.mapEffect((chunk) => Effect$3.gen(function* () {
		buf += chunk;
		const parts = buf.split("\n");
		const validChunks = [];
		for (const part of parts) try {
			validChunks.push(JSON.parse(part));
			buf = buf.slice(part.length + 1);
		} catch {}
		yield* Effect$3.logDebug("Received chunks").pipe(Effect$3.annotateLogs("chunk", chunk), Effect$3.annotateLogs("parsedChunks", validChunks), Effect$3.annotateLogs("buf", buf));
		return validChunks;
	})), Stream.mapEffect(S.decodeUnknown(S.Array(schema))), Stream.mapEffect(Effect$3.forEach((part) => onChunk(part))), Stream.runDrain, Effect$3.withLogSpan("handleJsonLineStream"));
};

//#endregion
//#region src/_internal/logger.ts
/**
* Config.logLevel counter-intuitively accepts LogLevel["label"]
* instead of a literal, ripping it and changing to accept literal
* Effect 4.0 will change this to accept a literal and then we can
* remove this and go back to the built-in validator.
*/
const ConfigLogLevel = (name) => {
	const config = Config$1.mapOrFail(Config$1.string(), (literal) => {
		const level = LogLevel.allLevels.find((level$1) => level$1._tag === literal);
		return level === void 0 ? Either$1.left(ConfigError.InvalidData([], `Expected a log level but received ${literal}`)) : Either$1.right(level);
	});
	return name === void 0 ? config : Config$1.nested(config, name);
};
const withMinimalLogLevel = ConfigLogLevel("logLevel").pipe(Config$1.withDefault(LogLevel.Info), Effect$2.andThen((level) => Logger.minimumLogLevel(level)), Effect$2.tapError((e) => Effect$2.logError("Invalid log level").pipe(Effect$2.annotateLogs("error", e))), Effect$2.catchTag("ConfigError", (e) => new UploadThingError({
	code: "INVALID_SERVER_CONFIG",
	message: "Invalid server configuration",
	cause: e
})), Layer$1.unwrapEffect);
const LogFormat = Config$1.literal("json", "logFmt", "structured", "pretty")("logFormat");
const withLogFormat = Effect$2.gen(function* () {
	const isDev = yield* IsDevelopment;
	const logFormat = yield* LogFormat.pipe(Config$1.withDefault(isDev ? "pretty" : "json"));
	return Logger[logFormat];
}).pipe(Effect$2.catchTag("ConfigError", (e) => new UploadThingError({
	code: "INVALID_SERVER_CONFIG",
	message: "Invalid server configuration",
	cause: e
})), Layer$1.unwrapEffect);
const logHttpClientResponse = (message, opts) => {
	const mixin = opts?.mixin ?? "json";
	const level = LogLevel.fromLiteral(opts?.level ?? "Debug");
	return (response) => Effect$2.flatMap(mixin !== "None" ? response[mixin] : Effect$2.void, () => Effect$2.logWithLevel(level, `${message} (${response.status})`).pipe(Effect$2.annotateLogs("response", response)));
};
const logHttpClientError = (message) => (err) => err._tag === "ResponseError" ? logHttpClientResponse(message, { level: "Error" })(err.response) : Effect$2.logError(message).pipe(Effect$2.annotateLogs("error", err));

//#endregion
//#region src/_internal/parser.ts
var ParserError = class extends Data$1.TaggedError("ParserError") {
	message = "Input validation failed. The original error with it's validation issues is in the error cause.";
};
function getParseFn(parser) {
	if ("parseAsync" in parser && typeof parser.parseAsync === "function")
 /**
	* Zod
	* TODO (next major): Consider wrapping ZodError in ParserError
	*/
	return parser.parseAsync;
	if (Schema$2.isSchema(parser))
 /**
	* Effect Schema
	*/
	return (value) => Schema$2.decodeUnknownPromise(parser)(value).catch((error) => {
		throw new ParserError({ cause: Cause.squash(error[Runtime.FiberFailureCauseId]) });
	});
	if ("~standard" in parser)
 /**
	* Standard Schema
	* TODO (next major): Consider moving this to the top of the function
	*/
	return async (value) => {
		const result = await parser["~standard"].validate(value);
		if (result.issues) throw new ParserError({ cause: result.issues });
		return result.value;
	};
	throw new Error("Invalid parser");
}

//#endregion
//#region src/_internal/route-config.ts
var FileSizeMismatch = class extends Data.Error {
	_tag = "FileSizeMismatch";
	name = "FileSizeMismatchError";
	constructor(type, max, actual) {
		const reason = `You uploaded a ${type} file that was ${bytesToFileSize(actual)}, but the limit for that type is ${max}`;
		super({ reason });
	}
};
var FileCountMismatch = class extends Data.Error {
	_tag = "FileCountMismatch";
	name = "FileCountMismatchError";
	constructor(type, boundtype, bound, actual) {
		const reason = `You uploaded ${actual} file(s) of type '${type}', but the ${boundtype} for that type is ${bound}`;
		super({ reason });
	}
};
const assertFilesMeetConfig = (files, routeConfig) => Effect$1.gen(function* () {
	const counts = {};
	for (const file of files) {
		const type = yield* matchFileType(file, objectKeys(routeConfig));
		counts[type] = (counts[type] ?? 0) + 1;
		const sizeLimit = routeConfig[type]?.maxFileSize;
		if (!sizeLimit) return yield* new InvalidRouteConfigError(type, "maxFileSize");
		const sizeLimitBytes = yield* fileSizeToBytes(sizeLimit);
		if (file.size > sizeLimitBytes) return yield* new FileSizeMismatch(type, sizeLimit, file.size);
	}
	for (const _key in counts) {
		const key = _key;
		const config = routeConfig[key];
		if (!config) return yield* new InvalidRouteConfigError(key);
		const count = counts[key];
		const min = config.minFileCount;
		const max = config.maxFileCount;
		if (min > max) return yield* new UploadThingError({
			code: "BAD_REQUEST",
			message: "Invalid config during file count - minFileCount > maxFileCount",
			cause: `minFileCount must be less than maxFileCount for key ${key}. got: ${min} > ${max}`
		});
		if (count != null && count < min) return yield* new FileCountMismatch(key, "minimum", min, count);
		if (count != null && count > max) return yield* new FileCountMismatch(key, "maximum", max, count);
	}
	return null;
});
const extractRouterConfig = (router) => Effect$1.forEach(objectKeys(router), (slug) => Effect$1.map(fillInputRouteConfig(router[slug].routerConfig), (config) => ({
	slug,
	config
})));

//#endregion
//#region src/_internal/runtime.ts
const makeRuntime = (fetch, config) => {
	const fetchHttpClient = Layer.provideMerge(FetchHttpClient.layer, Layer.succeed(FetchHttpClient.Fetch, fetch));
	const withRedactedHeaders = Layer.effectDiscard(FiberRef.update(Headers.currentRedactedNames, (_) => _.concat(["x-uploadthing-api-key"])));
	const layer = Layer.provide(Layer.mergeAll(withLogFormat, withMinimalLogLevel, fetchHttpClient, withRedactedHeaders), Layer.setConfigProvider(configProvider(config)));
	return ManagedRuntime.make(layer);
};

//#endregion
//#region src/_internal/types.ts
/**
* Marker used to select the region based on the incoming request
*/
const UTRegion = Symbol("uploadthing-region-symbol");
/**
* Marker used to append a `customId` to the incoming file data in `.middleware()`
* @example
* ```ts
* .middleware((opts) => {
*   return {
*     [UTFiles]: opts.files.map((file) => ({
*       ...file,
*       customId: generateId(),
*     }))
*   };
* })
* ```
*/
const UTFiles = Symbol("uploadthing-custom-id-symbol");

//#endregion
//#region src/_internal/handler.ts
var AdapterArguments = class extends Context.Tag("uploadthing/AdapterArguments")() {};
/**
* Create a request handler adapter for any framework or server library.
* Refer to the existing adapters for examples on how to use this function.
* @public
*
* @param makeAdapterArgs - Function that takes the args from your framework and returns an Effect that resolves to the adapter args.
* These args are passed to the `.middleware`, `.onUploadComplete`, and `.onUploadError` hooks.
* @param toRequest - Function that takes the args from your framework and returns an Effect that resolves to a web Request object.
* @param opts - The router config and other options that are normally passed to `createRequestHandler` of official adapters
* @param beAdapter - [Optional] The adapter name of the adapter, used for telemetry purposes
* @returns A function that takes the args from your framework and returns a promise that resolves to a Response object.
*/
const makeAdapterHandler = (makeAdapterArgs, toRequest, opts, beAdapter) => {
	const managed = makeRuntime(opts.config?.fetch, opts.config);
	const handle = Effect.promise(() => managed.runtime().then(HttpApp.toWebHandlerRuntime));
	const app = (...args) => Effect.map(Effect.promise(() => managed.runPromise(createRequestHandler(opts, beAdapter ?? "custom"))), Effect.provideServiceEffect(AdapterArguments, makeAdapterArgs(...args)));
	return async (...args) => {
		const result = await handle.pipe(Effect.ap(app(...args)), Effect.ap(toRequest(...args)), Effect.withLogSpan("requestHandler"), managed.runPromise);
		return result;
	};
};
const createRequestHandler = (opts, beAdapter) => Effect.gen(function* () {
	const isDevelopment = yield* IsDevelopment;
	const routerConfig = yield* extractRouterConfig(opts.router);
	const handleDaemon = (() => {
		if (opts.config?.handleDaemonPromise) return opts.config.handleDaemonPromise;
		return isDevelopment ? "void" : "await";
	})();
	if (isDevelopment && handleDaemon === "await") return yield* new UploadThingError({
		code: "INVALID_SERVER_CONFIG",
		message: "handleDaemonPromise: \"await\" is forbidden in development."
	});
	const GET = Effect.gen(function* () {
		return yield* HttpServerResponse.json(routerConfig);
	});
	const POST = Effect.gen(function* () {
		const { "uploadthing-hook": uploadthingHook, "x-uploadthing-package": fePackage, "x-uploadthing-version": clientVersion } = yield* HttpServerRequest.schemaHeaders(Schema$1.Struct({
			"uploadthing-hook": UploadThingHook.pipe(Schema$1.optional),
			"x-uploadthing-package": Schema$1.String.pipe(Schema$1.optionalWith({ default: () => "unknown" })),
			"x-uploadthing-version": Schema$1.String.pipe(Schema$1.optionalWith({ default: () => version }))
		}));
		if (clientVersion !== version) {
			const serverVersion = version;
			yield* Effect.logWarning("Client version mismatch. Things may not work as expected, please sync your versions to ensure compatibility.").pipe(Effect.annotateLogs({
				clientVersion,
				serverVersion
			}));
		}
		const { slug, actionType } = yield* HttpRouter.schemaParams(Schema$1.Struct({
			actionType: ActionType.pipe(Schema$1.optional),
			slug: Schema$1.String
		}));
		const uploadable = opts.router[slug];
		if (!uploadable) {
			const msg = `No file route found for slug ${slug}`;
			yield* Effect.logError(msg);
			return yield* new UploadThingError({
				code: "NOT_FOUND",
				message: msg
			});
		}
		const { body, fiber } = yield* Match.value({
			actionType,
			uploadthingHook
		}).pipe(Match.when({
			actionType: "upload",
			uploadthingHook: void 0
		}, () => handleUploadAction({
			uploadable,
			fePackage,
			beAdapter,
			slug
		})), Match.when({
			actionType: void 0,
			uploadthingHook: "callback"
		}, () => handleCallbackRequest({
			uploadable,
			fePackage,
			beAdapter
		})), Match.when({
			actionType: void 0,
			uploadthingHook: "error"
		}, () => handleErrorRequest({ uploadable })), Match.orElse(() => Effect.succeed({
			body: null,
			fiber: null
		})));
		if (fiber) {
			yield* Effect.logDebug("Running fiber as daemon").pipe(Effect.annotateLogs("handleDaemon", handleDaemon));
			if (handleDaemon === "void") {} else if (handleDaemon === "await") yield* fiber.await;
			else if (typeof handleDaemon === "function") handleDaemon(Effect.runPromise(fiber.await));
		}
		yield* Effect.logDebug("Sending response").pipe(Effect.annotateLogs("body", body));
		return yield* HttpServerResponse.json(body);
	}).pipe(Effect.catchTags({
		ParseError: (e) => HttpServerResponse.json(formatError(new UploadThingError({
			code: "BAD_REQUEST",
			message: "Invalid input",
			cause: e.message
		}), opts.router), { status: 400 }),
		UploadThingError: (e) => HttpServerResponse.json(formatError(e, opts.router), { status: getStatusCodeFromError(e) })
	}));
	const appendResponseHeaders = Effect.map(HttpServerResponse.setHeader("x-uploadthing-version", version));
	return HttpRouter.empty.pipe(HttpRouter.get("*", GET), HttpRouter.post("*", POST), HttpRouter.use(appendResponseHeaders));
}).pipe(Effect.withLogSpan("createRequestHandler"));
const handleErrorRequest = (opts) => Effect.gen(function* () {
	const { uploadable } = opts;
	const request = yield* HttpServerRequest.HttpServerRequest;
	const { apiKey } = yield* UTToken;
	const verified = yield* verifySignature(yield* request.text, request.headers["x-uploadthing-signature"] ?? null, apiKey);
	yield* Effect.logDebug(`Signature verified: ${verified}`);
	if (!verified) {
		yield* Effect.logError("Invalid signature");
		return yield* new UploadThingError({
			code: "BAD_REQUEST",
			message: "Invalid signature"
		});
	}
	const requestInput = yield* HttpServerRequest.schemaBodyJson(Schema$1.Struct({
		fileKey: Schema$1.String,
		error: Schema$1.String
	}));
	yield* Effect.logDebug("Handling error callback request with input:").pipe(Effect.annotateLogs("json", requestInput));
	const adapterArgs = yield* AdapterArguments;
	const fiber = yield* Effect.tryPromise({
		try: async () => uploadable.onUploadError({
			...adapterArgs,
			error: new UploadThingError({
				code: "UPLOAD_FAILED",
				message: `Upload failed for ${requestInput.fileKey}: ${requestInput.error}`
			}),
			fileKey: requestInput.fileKey
		}),
		catch: (error) => new UploadThingError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to run onUploadError",
			cause: error
		})
	}).pipe(Effect.tapError((error) => Effect.logError("Failed to run onUploadError. You probably shouldn't be throwing errors here.").pipe(Effect.annotateLogs("error", error)))).pipe(Effect.ignoreLogged, Effect.forkDaemon);
	return {
		body: null,
		fiber
	};
}).pipe(Effect.withLogSpan("handleErrorRequest"));
const handleCallbackRequest = (opts) => Effect.gen(function* () {
	const { uploadable, fePackage, beAdapter } = opts;
	const request = yield* HttpServerRequest.HttpServerRequest;
	const { apiKey } = yield* UTToken;
	const verified = yield* verifySignature(yield* request.text, request.headers["x-uploadthing-signature"] ?? null, apiKey);
	yield* Effect.logDebug(`Signature verified: ${verified}`);
	if (!verified) {
		yield* Effect.logError("Invalid signature");
		return yield* new UploadThingError({
			code: "BAD_REQUEST",
			message: "Invalid signature"
		});
	}
	const requestInput = yield* HttpServerRequest.schemaBodyJson(Schema$1.Struct({
		status: Schema$1.String,
		file: UploadedFileData,
		origin: Schema$1.String,
		metadata: Schema$1.Record({
			key: Schema$1.String,
			value: Schema$1.Unknown
		})
	}));
	yield* Effect.logDebug("Handling callback request with input:").pipe(Effect.annotateLogs("json", requestInput));
	/**
	* Run `.onUploadComplete` as a daemon to prevent the
	* request from UT to potentially timeout.
	*/
	const fiber = yield* Effect.gen(function* () {
		const adapterArgs = yield* AdapterArguments;
		const serverData = yield* Effect.tryPromise({
			try: async () => uploadable.onUploadComplete({
				...adapterArgs,
				file: {
					...requestInput.file,
					get url() {
						logDeprecationWarning("`file.url` is deprecated and will be removed in uploadthing v9. Use `file.ufsUrl` instead.");
						return requestInput.file.url;
					},
					get appUrl() {
						logDeprecationWarning("`file.appUrl` is deprecated and will be removed in uploadthing v9. Use `file.ufsUrl` instead.");
						return requestInput.file.appUrl;
					}
				},
				metadata: requestInput.metadata
			}),
			catch: (error) => new UploadThingError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to run onUploadComplete. You probably shouldn't be throwing errors here.",
				cause: error
			})
		});
		const payload = {
			fileKey: requestInput.file.key,
			callbackData: serverData ?? null
		};
		yield* Effect.logDebug("'onUploadComplete' callback finished. Sending response to UploadThing:").pipe(Effect.annotateLogs("callbackData", payload));
		const httpClient = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk);
		yield* HttpClientRequest.post(`/callback-result`).pipe(HttpClientRequest.prependUrl(requestInput.origin), HttpClientRequest.setHeaders({
			"x-uploadthing-api-key": Redacted.value(apiKey),
			"x-uploadthing-version": version,
			"x-uploadthing-be-adapter": beAdapter,
			"x-uploadthing-fe-package": fePackage
		}), HttpClientRequest.bodyJson(payload), Effect.flatMap(httpClient.execute), Effect.tapError(logHttpClientError("Failed to register callback result")), Effect.flatMap(HttpClientResponse.schemaBodyJson(CallbackResultResponse)), Effect.tap(Effect.log("Sent callback result to UploadThing")), Effect.scoped);
	}).pipe(Effect.ignoreLogged, Effect.forkDaemon);
	return {
		body: null,
		fiber
	};
}).pipe(Effect.withLogSpan("handleCallbackRequest"));
const runRouteMiddleware = (opts) => Effect.gen(function* () {
	const { json: { files, input }, uploadable } = opts;
	yield* Effect.logDebug("Running middleware");
	const adapterArgs = yield* AdapterArguments;
	const metadata = yield* Effect.tryPromise({
		try: async () => uploadable.middleware({
			...adapterArgs,
			input,
			files
		}),
		catch: (error) => error instanceof UploadThingError ? error : new UploadThingError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to run middleware",
			cause: error
		})
	});
	if (metadata[UTFiles] && metadata[UTFiles].length !== files.length) {
		const msg = `Expected files override to have the same length as original files, got ${metadata[UTFiles].length} but expected ${files.length}`;
		yield* Effect.logError(msg);
		return yield* new UploadThingError({
			code: "BAD_REQUEST",
			message: "Files override must have the same length as files",
			cause: msg
		});
	}
	const filesWithCustomIds = yield* Effect.forEach(files, (file, idx) => Effect.gen(function* () {
		const theirs = metadata[UTFiles]?.[idx];
		if (theirs && theirs.size !== file.size) yield* Effect.logWarning("File size mismatch. Reverting to original size");
		return {
			name: theirs?.name ?? file.name,
			size: file.size,
			type: file.type,
			customId: theirs?.customId,
			lastModified: theirs?.lastModified ?? Date.now()
		};
	}));
	return {
		metadata,
		filesWithCustomIds,
		preferredRegion: metadata[UTRegion]
	};
}).pipe(Effect.withLogSpan("runRouteMiddleware"));
const handleUploadAction = (opts) => Effect.gen(function* () {
	const httpClient = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk);
	const { uploadable, fePackage, beAdapter, slug } = opts;
	const json = yield* HttpServerRequest.schemaBodyJson(UploadActionPayload);
	yield* Effect.logDebug("Handling upload request").pipe(Effect.annotateLogs("json", json));
	yield* Effect.logDebug("Parsing user input");
	const parsedInput = yield* Effect.tryPromise({
		try: () => getParseFn(uploadable.inputParser)(json.input),
		catch: (error) => new UploadThingError({
			code: "BAD_REQUEST",
			message: "Invalid input",
			cause: error
		})
	});
	yield* Effect.logDebug("Input parsed successfully").pipe(Effect.annotateLogs("input", parsedInput));
	const { metadata, filesWithCustomIds, preferredRegion } = yield* runRouteMiddleware({
		json: {
			input: parsedInput,
			files: json.files
		},
		uploadable
	});
	yield* Effect.logDebug("Parsing route config").pipe(Effect.annotateLogs("routerConfig", uploadable.routerConfig));
	const parsedConfig = yield* fillInputRouteConfig(uploadable.routerConfig).pipe(Effect.catchTag("InvalidRouteConfig", (err) => new UploadThingError({
		code: "BAD_REQUEST",
		message: "Invalid route config",
		cause: err
	})));
	yield* Effect.logDebug("Route config parsed successfully").pipe(Effect.annotateLogs("routeConfig", parsedConfig));
	yield* Effect.logDebug("Validating files meet the config requirements").pipe(Effect.annotateLogs("files", json.files));
	yield* assertFilesMeetConfig(json.files, parsedConfig).pipe(Effect.mapError((e) => new UploadThingError({
		code: "BAD_REQUEST",
		message: `Invalid config: ${e._tag}`,
		cause: "reason" in e ? e.reason : e.message
	})));
	yield* Effect.logDebug("Files validated.");
	const fileUploadRequests = yield* Effect.forEach(filesWithCustomIds, (file) => Effect.map(matchFileType(file, objectKeys(parsedConfig)), (type) => ({
		name: file.name,
		size: file.size,
		type: file.type || type,
		lastModified: file.lastModified,
		customId: file.customId,
		contentDisposition: parsedConfig[type]?.contentDisposition ?? "inline",
		acl: parsedConfig[type]?.acl
	}))).pipe(Effect.catchTags({
		InvalidFileType: (e) => Effect.die(e),
		UnknownFileType: (e) => Effect.die(e)
	}));
	const routeOptions = uploadable.routeOptions;
	const { apiKey, appId } = yield* UTToken;
	const ingestUrl = yield* IngestUrl(preferredRegion);
	const isDev = yield* IsDevelopment;
	yield* Effect.logDebug("Generating presigned URLs").pipe(Effect.annotateLogs("fileUploadRequests", fileUploadRequests), Effect.annotateLogs("ingestUrl", ingestUrl));
	const presignedUrls = yield* Effect.forEach(fileUploadRequests, (file) => Effect.gen(function* () {
		const key = yield* generateKey(file, appId, routeOptions.getFileHashParts);
		const url = yield* generateSignedURL(`${ingestUrl}/${key}`, apiKey, {
			ttlInSeconds: routeOptions.presignedURLTTL,
			data: {
				"x-ut-identifier": appId,
				"x-ut-file-name": file.name,
				"x-ut-file-size": file.size,
				"x-ut-file-type": file.type,
				"x-ut-slug": slug,
				"x-ut-custom-id": file.customId,
				"x-ut-content-disposition": file.contentDisposition,
				"x-ut-acl": file.acl
			}
		});
		return {
			url,
			key
		};
	}), { concurrency: "unbounded" });
	const serverReq = yield* HttpServerRequest.HttpServerRequest;
	const requestUrl = yield* HttpServerRequest.toURL(serverReq);
	const devHookRequest = yield* Config.string("callbackUrl").pipe(Config.withDefault(requestUrl.origin + requestUrl.pathname), Effect.map((url) => HttpClientRequest.post(url).pipe(HttpClientRequest.appendUrlParam("slug", slug))));
	const metadataRequest = HttpClientRequest.post("/route-metadata").pipe(HttpClientRequest.prependUrl(ingestUrl), HttpClientRequest.setHeaders({
		"x-uploadthing-api-key": Redacted.value(apiKey),
		"x-uploadthing-version": version,
		"x-uploadthing-be-adapter": beAdapter,
		"x-uploadthing-fe-package": fePackage
	}), HttpClientRequest.bodyJson({
		fileKeys: presignedUrls.map(({ key }) => key),
		metadata,
		isDev,
		callbackUrl: devHookRequest.url,
		callbackSlug: slug,
		awaitServerData: routeOptions.awaitServerData ?? true
	}), Effect.flatMap(httpClient.execute));
	const handleDevStreamError = Effect.fn("handleDevStreamError")(function* (err, chunk) {
		const schema = Schema$1.parseJson(Schema$1.Struct({ file: UploadedFileData }));
		const parsedChunk = yield* Schema$1.decodeUnknown(schema)(chunk);
		const key = parsedChunk.file.key;
		yield* Effect.logError("Failed to forward callback request from dev stream").pipe(Effect.annotateLogs({
			fileKey: key,
			error: err.message
		}));
		const httpResponse = yield* HttpClientRequest.post("/callback-result").pipe(HttpClientRequest.prependUrl(ingestUrl), HttpClientRequest.setHeaders({
			"x-uploadthing-api-key": Redacted.value(apiKey),
			"x-uploadthing-version": version,
			"x-uploadthing-be-adapter": beAdapter,
			"x-uploadthing-fe-package": fePackage
		}), HttpClientRequest.bodyJson({
			fileKey: key,
			error: `Failed to forward callback request from dev stream: ${err.message}`
		}), Effect.flatMap(httpClient.execute));
		yield* logHttpClientResponse("Reported callback error to UploadThing")(httpResponse);
	});
	const fiber = yield* Effect.if(isDev, {
		onTrue: () => metadataRequest.pipe(Effect.tapBoth({
			onSuccess: logHttpClientResponse("Registered metadata", { mixin: "None" }),
			onFailure: logHttpClientError("Failed to register metadata")
		}), HttpClientResponse.stream, handleJsonLineStream(MetadataFetchStreamPart, (chunk) => devHookRequest.pipe(HttpClientRequest.setHeaders({
			"uploadthing-hook": chunk.hook,
			"x-uploadthing-signature": chunk.signature
		}), HttpClientRequest.setBody(HttpBody.text(chunk.payload, "application/json")), httpClient.execute, Effect.tap(logHttpClientResponse("Successfully forwarded callback request from dev stream")), Effect.catchTag("ResponseError", (err) => handleDevStreamError(err, chunk.payload)), Effect.annotateLogs(chunk), Effect.asVoid, Effect.ignoreLogged, Effect.scoped))),
		onFalse: () => metadataRequest.pipe(Effect.tapBoth({
			onSuccess: logHttpClientResponse("Registered metadata"),
			onFailure: logHttpClientError("Failed to register metadata")
		}), Effect.flatMap(HttpClientResponse.schemaBodyJson(MetadataFetchResponse)), Effect.scoped)
	}).pipe(Effect.forkDaemon);
	const presigneds = presignedUrls.map((p, i) => ({
		url: p.url,
		key: p.key,
		name: fileUploadRequests[i].name,
		customId: fileUploadRequests[i].customId ?? null
	}));
	yield* Effect.logInfo("Sending presigned URLs to client").pipe(Effect.annotateLogs("presignedUrls", presigneds));
	return {
		body: presigneds,
		fiber
	};
}).pipe(Effect.withLogSpan("handleUploadAction"));

//#endregion
//#region src/_internal/upload-builder.ts
function internalCreateBuilder(initDef = {}) {
	const _def = {
		$types: {},
		routerConfig: { image: { maxFileSize: "4MB" } },
		routeOptions: { awaitServerData: true },
		inputParser: {
			parseAsync: () => Promise.resolve(void 0),
			_input: void 0,
			_output: void 0
		},
		middleware: () => ({}),
		onUploadError: () => {},
		onUploadComplete: () => void 0,
		errorFormatter: initDef.errorFormatter ?? defaultErrorFormatter,
		...initDef
	};
	return {
		input(userParser) {
			return internalCreateBuilder({
				..._def,
				inputParser: userParser
			});
		},
		middleware(userMiddleware) {
			return internalCreateBuilder({
				..._def,
				middleware: userMiddleware
			});
		},
		onUploadComplete(userUploadComplete) {
			return {
				..._def,
				onUploadComplete: userUploadComplete
			};
		},
		onUploadError(userOnUploadError) {
			return internalCreateBuilder({
				..._def,
				onUploadError: userOnUploadError
			});
		}
	};
}
/**
* Create a builder for your backend adapter.
* Refer to the existing adapters for examples on how to use this function.
* @public
*
* @param opts - Options for the builder
* @returns A file route builder for making UploadThing file routes
*/
function createBuilder(opts) {
	return (input, config) => {
		return internalCreateBuilder({
			routerConfig: input,
			routeOptions: config ?? {},
			...opts
		});
	};
}

//#endregion
export { AdapterArguments, ApiUrl, IngestUrl, UTFiles as UTFiles$1, UTRegion as UTRegion$1, UTToken, UfsAppIdLocation, UfsHost, configProvider, createBuilder, createRequestHandler, extractRouterConfig, logHttpClientError, logHttpClientResponse, makeAdapterHandler, makeRuntime };
//# sourceMappingURL=upload-builder-e0_p9NOT.js.map