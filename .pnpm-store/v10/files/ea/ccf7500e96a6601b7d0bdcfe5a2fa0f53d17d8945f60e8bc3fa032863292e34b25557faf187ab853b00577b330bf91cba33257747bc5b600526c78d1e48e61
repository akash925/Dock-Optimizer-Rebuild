import "../dist/package-Beb-iarE.js";
import "../dist/deprecations-pLmw6Ytd.js";
import "../dist/shared-schemas-BIFDoqPF.js";
import { UTFiles$1 as UTFiles, UTRegion$1 as UTRegion, createBuilder, makeAdapterHandler } from "../dist/upload-builder-e0_p9NOT.js";
import * as Effect from "effect/Effect";
import { defineEventHandler, toWebRequest } from "h3";

//#region src/h3.ts
const createUploadthing = (opts) => createBuilder(opts);
const createRouteHandler = (opts) => {
	const handler = makeAdapterHandler((event) => Effect.succeed({ event }), (event) => Effect.succeed(toWebRequest(event)), opts, "h3");
	return defineEventHandler(handler);
};

//#endregion
export { UTFiles, createRouteHandler, createUploadthing, UTRegion as experimental_UTRegion };
//# sourceMappingURL=index.js.map