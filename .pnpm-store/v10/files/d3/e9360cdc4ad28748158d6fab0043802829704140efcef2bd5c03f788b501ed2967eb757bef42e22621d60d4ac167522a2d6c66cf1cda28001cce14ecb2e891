import { version } from "../dist/package-Beb-iarE.js";
import { logDeprecationWarning } from "../dist/deprecations-pLmw6Ytd.js";
import "../dist/shared-schemas-BIFDoqPF.js";
import { ApiUrl, IngestUrl, UTFiles$1 as UTFiles, UTRegion$1 as UTRegion, UTToken, UfsAppIdLocation, UfsHost, createBuilder, extractRouterConfig, logHttpClientError, logHttpClientResponse, makeAdapterHandler, makeRuntime } from "../dist/upload-builder-e0_p9NOT.js";
import * as Arr from "effect/Array";
import { UploadThingError, UploadThingError as UploadThingError$1, generateKey, generateSignedURL, parseTimeToSeconds } from "@uploadthing/shared";
import { unsafeCoerce } from "effect/Function";
import * as Predicate from "effect/Predicate";
import * as Effect$3 from "effect/Effect";
import * as Effect$2 from "effect/Effect";
import * as Effect$1 from "effect/Effect";
import * as Effect from "effect/Effect";
import * as HttpClient$2 from "@effect/platform/HttpClient";
import * as HttpClient$1 from "@effect/platform/HttpClient";
import * as HttpClient from "@effect/platform/HttpClient";
import * as HttpClientRequest$2 from "@effect/platform/HttpClientRequest";
import * as HttpClientRequest$1 from "@effect/platform/HttpClientRequest";
import * as HttpClientRequest from "@effect/platform/HttpClientRequest";
import * as HttpClientResponse from "@effect/platform/HttpClientResponse";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Cause from "effect/Cause";
import { lookup } from "@uploadthing/mime-types";

//#region src/sdk/ut-file.ts
/**
* Extension of the Blob class that simplifies setting the `name` and `customId` properties,
* similar to the built-in File class from Node > 20.
*/
var UTFile = class extends Blob {
	name;
	lastModified;
	customId;
	constructor(parts, name, options) {
		const optionsWithDefaults = {
			...options,
			type: options?.type ?? (lookup(name) || "application/octet-stream"),
			lastModified: options?.lastModified ?? Date.now()
		};
		super(parts, optionsWithDefaults);
		this.name = name;
		this.customId = optionsWithDefaults.customId;
		this.lastModified = optionsWithDefaults.lastModified;
	}
};

//#endregion
//#region src/_internal/upload-server.ts
const uploadWithoutProgress = (file, presigned) => Effect$3.gen(function* () {
	const formData = new FormData();
	formData.append("file", file);
	const httpClient = (yield* HttpClient$2.HttpClient).pipe(HttpClient$2.filterStatusOk);
	const json = yield* HttpClientRequest$2.put(presigned.url).pipe(HttpClientRequest$2.bodyFormData(formData), HttpClientRequest$2.setHeader("Range", "bytes=0-"), HttpClientRequest$2.setHeader("x-uploadthing-version", version), httpClient.execute, Effect$3.tapError(logHttpClientError("Failed to upload file")), Effect$3.mapError((e) => new UploadThingError$1({
		code: "UPLOAD_FAILED",
		message: "Failed to upload file",
		cause: e
	})), Effect$3.andThen((_) => _.json), Effect$3.andThen(unsafeCoerce), Effect$3.scoped);
	yield* Effect$3.logDebug(`File ${file.name} uploaded successfully`).pipe(Effect$3.annotateLogs("json", json));
	return {
		...json,
		get url() {
			logDeprecationWarning("`file.url` is deprecated and will be removed in uploadthing v9. Use `file.ufsUrl` instead.");
			return json.url;
		},
		get appUrl() {
			logDeprecationWarning("`file.appUrl` is deprecated and will be removed in uploadthing v9. Use `file.ufsUrl` instead.");
			return json.appUrl;
		}
	};
});

//#endregion
//#region src/sdk/utils.ts
function guardServerOnly() {
	if (typeof window !== "undefined") throw new UploadThingError$1({
		code: "INTERNAL_SERVER_ERROR",
		message: "The `utapi` can only be used on the server."
	});
}
const downloadFile = (_url) => Effect$2.gen(function* () {
	let url = Predicate.isRecord(_url) ? _url.url : _url;
	if (typeof url === "string") {
		if (url.startsWith("data:")) return yield* Effect$2.fail({
			code: "BAD_REQUEST",
			message: "Please use uploadFiles() for data URLs. uploadFilesFromUrl() is intended for use with remote URLs only.",
			data: void 0
		});
	}
	url = new URL(url);
	const { name = url.pathname.split("/").pop() ?? "unknown-filename", customId = void 0 } = Predicate.isRecord(_url) ? _url : {};
	const httpClient = (yield* HttpClient$1.HttpClient).pipe(HttpClient$1.filterStatusOk);
	const arrayBuffer = yield* HttpClientRequest$1.get(url).pipe(HttpClientRequest$1.modify({ headers: {} }), httpClient.execute, Effect$2.flatMap((_) => _.arrayBuffer), Effect$2.mapError((cause) => {
		return {
			code: "BAD_REQUEST",
			message: `Failed to download requested file: ${cause.message}`,
			data: cause.toJSON()
		};
	}), Effect$2.scoped);
	return new UTFile([arrayBuffer], name, {
		customId,
		lastModified: Date.now()
	});
}).pipe(Effect$2.withLogSpan("downloadFile"));
const generatePresignedUrl = (file, cd, acl) => Effect$2.gen(function* () {
	const { apiKey, appId } = yield* UTToken;
	const baseUrl = yield* IngestUrl(void 0);
	const key = yield* generateKey(file, appId);
	const url = yield* generateSignedURL(`${baseUrl}/${key}`, apiKey, { data: {
		"x-ut-identifier": appId,
		"x-ut-file-name": file.name,
		"x-ut-file-size": file.size,
		"x-ut-file-type": file.type,
		"x-ut-custom-id": file.customId,
		"x-ut-content-disposition": cd,
		"x-ut-acl": acl
	} });
	return {
		url,
		key
	};
}).pipe(Effect$2.withLogSpan("generatePresignedUrl"));
const uploadFile = (file, opts) => Effect$2.gen(function* () {
	const presigned = yield* generatePresignedUrl(file, opts.contentDisposition ?? "inline", opts.acl).pipe(Effect$2.catchTag("UploadThingError", (e) => Effect$2.fail(UploadThingError$1.toObject(e))), Effect$2.catchTag("ConfigError", () => Effect$2.fail({
		code: "INVALID_SERVER_CONFIG",
		message: "Failed to generate presigned URL"
	})));
	const response = yield* uploadWithoutProgress(file, presigned).pipe(Effect$2.catchTag("UploadThingError", (e) => Effect$2.fail(UploadThingError$1.toObject(e))), Effect$2.catchTag("ResponseError", (e) => Effect$2.fail({
		code: "UPLOAD_FAILED",
		message: "Failed to upload file",
		data: e.toJSON()
	})));
	return {
		key: presigned.key,
		url: response.url,
		appUrl: response.appUrl,
		ufsUrl: response.ufsUrl,
		lastModified: file.lastModified ?? Date.now(),
		name: file.name,
		size: file.size,
		type: file.type,
		customId: file.customId ?? null,
		fileHash: response.fileHash
	};
}).pipe(Effect$2.withLogSpan("uploadFile"));

//#endregion
//#region src/sdk/index.ts
var UTApi = class {
	fetch;
	defaultKeyType;
	runtime;
	opts;
	constructor(options) {
		guardServerOnly();
		this.opts = options ?? {};
		this.fetch = this.opts.fetch ?? globalThis.fetch;
		this.defaultKeyType = this.opts.defaultKeyType ?? "fileKey";
		this.runtime = makeRuntime(this.fetch, this.opts);
	}
	requestUploadThing = (pathname, body, responseSchema) => Effect$1.gen(this, function* () {
		const { apiKey } = yield* UTToken;
		const baseUrl = yield* ApiUrl;
		const httpClient = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk);
		return yield* HttpClientRequest.post(pathname).pipe(HttpClientRequest.prependUrl(baseUrl), HttpClientRequest.bodyUnsafeJson(body), HttpClientRequest.setHeaders({
			"x-uploadthing-version": version,
			"x-uploadthing-be-adapter": "server-sdk",
			"x-uploadthing-api-key": Redacted.value(apiKey)
		}), httpClient.execute, Effect$1.tapBoth({
			onSuccess: logHttpClientResponse("UploadThing API Response"),
			onFailure: logHttpClientError("Failed to request UploadThing API")
		}), Effect$1.flatMap(HttpClientResponse.schemaBodyJson(responseSchema)), Effect$1.scoped);
	}).pipe(Effect$1.catchTag("ConfigError", (e) => new UploadThingError$1({
		code: "INVALID_SERVER_CONFIG",
		message: "There was an error with the server configuration. More info can be found on this error's `cause` property",
		cause: e
	})), Effect$1.withLogSpan("utapi.#requestUploadThing"));
	executeAsync = async (program, signal) => {
		const exit = await program.pipe(Effect$1.withLogSpan("utapi.#executeAsync"), (e) => this.runtime.runPromiseExit(e, signal ? { signal } : void 0));
		if (exit._tag === "Failure") throw Cause.squash(exit.cause);
		return exit.value;
	};
	uploadFiles(files, opts) {
		guardServerOnly();
		const concurrency = opts?.concurrency ?? 1;
		if (concurrency < 1 || concurrency > 25) throw new UploadThingError$1({
			code: "BAD_REQUEST",
			message: "concurrency must be a positive integer between 1 and 25"
		});
		const program = Effect$1.forEach(Arr.ensure(files), (file) => uploadFile(file, opts ?? {}).pipe(Effect$1.match({
			onSuccess: (data) => ({
				data,
				error: null
			}),
			onFailure: (error) => ({
				data: null,
				error
			})
		})), { concurrency }).pipe(Effect$1.map((ups) => Array.isArray(files) ? ups : ups[0]), Effect$1.tap((res) => Effect$1.logDebug("Finished uploading").pipe(Effect$1.annotateLogs("uploadResult", res))), Effect$1.withLogSpan("uploadFiles"));
		return this.executeAsync(program, opts?.signal);
	}
	uploadFilesFromUrl(urls, opts) {
		guardServerOnly();
		const concurrency = opts?.concurrency ?? 1;
		if (concurrency < 1 || concurrency > 25) throw new UploadThingError$1({
			code: "BAD_REQUEST",
			message: "concurrency must be a positive integer between 1 and 25"
		});
		const program = Effect$1.forEach(Arr.ensure(urls), (url) => downloadFile(url).pipe(Effect$1.flatMap((file) => uploadFile(file, opts ?? {})), Effect$1.match({
			onSuccess: (data) => ({
				data,
				error: null
			}),
			onFailure: (error) => ({
				data: null,
				error
			})
		})), { concurrency }).pipe(Effect$1.map((ups) => Array.isArray(urls) ? ups : ups[0]), Effect$1.tap((res) => Effect$1.logDebug("Finished uploading").pipe(Effect$1.annotateLogs("uploadResult", res))), Effect$1.withLogSpan("uploadFiles")).pipe(Effect$1.withLogSpan("uploadFilesFromUrl"));
		return this.executeAsync(program, opts?.signal);
	}
	/**
	* Request to delete files from UploadThing storage.
	* @param {string | string[]} fileKeys
	*
	* @example
	* await deleteFiles("2e0fdb64-9957-4262-8e45-f372ba903ac8_image.jpg");
	*
	* @example
	* await deleteFiles(["2e0fdb64-9957-4262-8e45-f372ba903ac8_image.jpg","1649353b-04ea-48a2-9db7-31de7f562c8d_image2.jpg"])
	*
	* @example
	* await deleteFiles("myCustomIdentifier", { keyType: "customId" })
	*/
	deleteFiles = async (keys, opts) => {
		guardServerOnly();
		const { keyType = this.defaultKeyType } = opts ?? {};
		class DeleteFileResponse extends S.Class("DeleteFileResponse")({
			success: S.Boolean,
			deletedCount: S.Number
		}) {}
		return await this.executeAsync(this.requestUploadThing("/v6/deleteFiles", keyType === "fileKey" ? { fileKeys: Arr.ensure(keys) } : { customIds: Arr.ensure(keys) }, DeleteFileResponse).pipe(Effect$1.withLogSpan("deleteFiles")));
	};
	/**
	* Request file URLs from UploadThing storage.
	* @param {string | string[]} fileKeys
	*
	* @example
	* const data = await getFileUrls("2e0fdb64-9957-4262-8e45-f372ba903ac8_image.jpg");
	* console.log(data); // [{key: "2e0fdb64-9957-4262-8e45-f372ba903ac8_image.jpg", url: "https://uploadthing.com/f/2e0fdb64-9957-4262-8e45-f372ba903ac8_image.jpg"}]
	*
	* @example
	* const data = await getFileUrls(["2e0fdb64-9957-4262-8e45-f372ba903ac8_image.jpg","1649353b-04ea-48a2-9db7-31de7f562c8d_image2.jpg"])
	* console.log(data) // [{key: "2e0fdb64-9957-4262-8e45-f372ba903ac8_image.jpg", url: "https://uploadthing.com/f/2e0fdb64-9957-4262-8e45-f372ba903ac8_image.jpg" },{key: "1649353b-04ea-48a2-9db7-31de7f562c8d_image2.jpg", url: "https://uploadthing.com/f/1649353b-04ea-48a2-9db7-31de7f562c8d_image2.jpg"}]
	*
	* @deprecated - See https://docs.uploadthing.com/working-with-files#accessing-files for info how to access files
	*/
	getFileUrls = async (keys, opts) => {
		guardServerOnly();
		const { keyType = this.defaultKeyType } = opts ?? {};
		class GetFileUrlResponse extends S.Class("GetFileUrlResponse")({ data: S.Array(S.Struct({
			key: S.String,
			url: S.String
		})) }) {}
		return await this.executeAsync(this.requestUploadThing("/v6/getFileUrl", keyType === "fileKey" ? { fileKeys: Arr.ensure(keys) } : { customIds: Arr.ensure(keys) }, GetFileUrlResponse).pipe(Effect$1.withLogSpan("getFileUrls")));
	};
	/**
	* Request file list from UploadThing storage.
	* @param {object} opts
	* @param {number} opts.limit The maximum number of files to return
	* @param {number} opts.offset The number of files to skip
	*
	* @example
	* const data = await listFiles({ limit: 1 });
	* console.log(data); // { key: "2e0fdb64-9957-4262-8e45-f372ba903ac8_image.jpg", id: "2e0fdb64-9957-4262-8e45-f372ba903ac8" }
	*/
	listFiles = async (opts) => {
		guardServerOnly();
		class ListFileResponse extends S.Class("ListFileResponse")({
			hasMore: S.Boolean,
			files: S.Array(S.Struct({
				id: S.String,
				customId: S.NullOr(S.String),
				key: S.String,
				name: S.String,
				size: S.Number,
				status: S.Literal("Deletion Pending", "Failed", "Uploaded", "Uploading"),
				uploadedAt: S.Number
			}))
		}) {}
		return await this.executeAsync(this.requestUploadThing("/v6/listFiles", { ...opts }, ListFileResponse).pipe(Effect$1.withLogSpan("listFiles")));
	};
	renameFiles = async (updates) => {
		guardServerOnly();
		class RenameFileResponse extends S.Class("RenameFileResponse")({ success: S.Boolean }) {}
		return await this.executeAsync(this.requestUploadThing("/v6/renameFiles", { updates: Arr.ensure(updates) }, RenameFileResponse).pipe(Effect$1.withLogSpan("renameFiles")));
	};
	getUsageInfo = async () => {
		guardServerOnly();
		class GetUsageInfoResponse extends S.Class("GetUsageInfoResponse")({
			totalBytes: S.Number,
			appTotalBytes: S.Number,
			filesUploaded: S.Number,
			limitBytes: S.Number
		}) {}
		return await this.executeAsync(this.requestUploadThing("/v6/getUsageInfo", {}, GetUsageInfoResponse).pipe(Effect$1.withLogSpan("getUsageInfo")));
	};
	/**
	* Generate a presigned url for a private file
	* Unlike {@link getSignedURL}, this method does not make a fetch request to the UploadThing API
	* and is the recommended way to generate a presigned url for a private file.
	**/
	generateSignedURL = async (key, opts) => {
		guardServerOnly();
		const expiresIn = parseTimeToSeconds(opts?.expiresIn ?? "5 minutes");
		if (opts?.expiresIn && isNaN(expiresIn)) throw new UploadThingError$1({
			code: "BAD_REQUEST",
			message: "expiresIn must be a valid time string, for example '1d', '2 days', or a number of seconds."
		});
		if (expiresIn > 86400 * 7) throw new UploadThingError$1({
			code: "BAD_REQUEST",
			message: "expiresIn must be less than 7 days (604800 seconds)."
		});
		const program = Effect$1.gen(function* () {
			const { apiKey, appId } = yield* UTToken;
			const appIdLocation = yield* UfsAppIdLocation;
			const ufsHost = yield* UfsHost;
			const proto = ufsHost.includes("local") ? "http" : "https";
			const urlBase = appIdLocation === "subdomain" ? `${proto}://${appId}.${ufsHost}/f/${key}` : `${proto}://${ufsHost}/a/${appId}/${key}`;
			const ufsUrl = yield* generateSignedURL(urlBase, apiKey, { ttlInSeconds: expiresIn });
			return { ufsUrl };
		});
		return await this.executeAsync(program.pipe(Effect$1.catchTag("ConfigError", (e) => new UploadThingError$1({
			code: "INVALID_SERVER_CONFIG",
			message: "There was an error with the server configuration. More info can be found on this error's `cause` property",
			cause: e
		})), Effect$1.withLogSpan("generateSignedURL")));
	};
	/**
	* Request a presigned url for a private file(s)
	* @remarks This method is no longer recommended as it makes a fetch
	* request to the UploadThing API which incurs redundant latency. It
	* will be deprecated in UploadThing v8 and removed in UploadThing v9.
	*
	* @see {@link generateSignedURL} for a more efficient way to generate a presigned url
	**/
	getSignedURL = async (key, opts) => {
		guardServerOnly();
		const expiresIn = opts?.expiresIn ? parseTimeToSeconds(opts.expiresIn) : void 0;
		const { keyType = this.defaultKeyType } = opts ?? {};
		if (opts?.expiresIn && isNaN(expiresIn)) throw new UploadThingError$1({
			code: "BAD_REQUEST",
			message: "expiresIn must be a valid time string, for example '1d', '2 days', or a number of seconds."
		});
		if (expiresIn && expiresIn > 86400 * 7) throw new UploadThingError$1({
			code: "BAD_REQUEST",
			message: "expiresIn must be less than 7 days (604800 seconds)."
		});
		class GetSignedUrlResponse extends S.Class("GetSignedUrlResponse")({
			url: S.String,
			ufsUrl: S.String
		}) {}
		return await this.executeAsync(this.requestUploadThing("/v6/requestFileAccess", keyType === "fileKey" ? {
			fileKey: key,
			expiresIn
		} : {
			customId: key,
			expiresIn
		}, GetSignedUrlResponse).pipe(Effect$1.withLogSpan("getSignedURL")));
	};
	/**
	* Update the ACL of a file or set of files.
	*
	* @example
	* // Make a single file public
	* await utapi.updateACL("2e0fdb64-9957-4262-8e45-f372ba903ac8_image.jpg", "public-read");
	*
	* // Make multiple files private
	* await utapi.updateACL(
	*   [
	*     "2e0fdb64-9957-4262-8e45-f372ba903ac8_image.jpg",
	*     "1649353b-04ea-48a2-9db7-31de7f562c8d_image2.jpg",
	*   ],
	*   "private",
	* );
	*/
	updateACL = async (keys, acl, opts) => {
		guardServerOnly();
		const { keyType = this.defaultKeyType } = opts ?? {};
		const updates = Arr.ensure(keys).map((key) => {
			return keyType === "fileKey" ? {
				fileKey: key,
				acl
			} : {
				customId: key,
				acl
			};
		});
		const responseSchema = S.Struct({ success: S.Boolean });
		return await this.executeAsync(this.requestUploadThing("/v6/updateACL", { updates }, responseSchema).pipe(Effect$1.withLogSpan("updateACL")));
	};
};

//#endregion
//#region src/server.ts
const createUploadthing = (opts) => createBuilder(opts);
const createRouteHandler = (opts) => {
	return makeAdapterHandler((ev) => Effect.succeed({ req: "request" in ev ? ev.request : ev }), (ev) => Effect.succeed("request" in ev ? ev.request : ev), opts, "server");
};
const extractRouterConfig$1 = (router) => Effect.runSync(extractRouterConfig(router));

//#endregion
export { UTApi, UTFile, UTFiles, UploadThingError, createBuilder, createRouteHandler, createUploadthing, UTRegion as experimental_UTRegion, extractRouterConfig$1 as extractRouterConfig, makeAdapterHandler };
//# sourceMappingURL=index.js.map