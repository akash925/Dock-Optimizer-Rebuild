import "../dist/package-Beb-iarE.js";
import "../dist/deprecations-pLmw6Ytd.js";
import "../dist/shared-schemas-BIFDoqPF.js";
import { UTFiles$1 as UTFiles, UTRegion$1 as UTRegion, createBuilder, makeAdapterHandler } from "../dist/upload-builder-e0_p9NOT.js";
import * as Effect from "effect/Effect";

//#region src/next.ts
const createUploadthing = (opts) => createBuilder(opts);
const createRouteHandler = (opts) => {
	const handler = makeAdapterHandler((req) => Effect.succeed({ req }), (req) => Effect.succeed(req), opts, "nextjs-app");
	return {
		POST: handler,
		GET: handler
	};
};

//#endregion
export { UTFiles, createRouteHandler, createUploadthing, UTRegion as experimental_UTRegion };
//# sourceMappingURL=index.js.map