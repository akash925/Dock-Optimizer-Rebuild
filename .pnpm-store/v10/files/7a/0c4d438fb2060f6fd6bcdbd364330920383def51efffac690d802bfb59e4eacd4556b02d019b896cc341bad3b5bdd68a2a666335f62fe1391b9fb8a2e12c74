import "../dist/package-Beb-iarE.js";
import "../dist/deprecations-pLmw6Ytd.js";
import "../dist/shared-schemas-BIFDoqPF.js";
import { UTFiles$1 as UTFiles, UTRegion$1 as UTRegion, createBuilder, makeAdapterHandler } from "../dist/upload-builder-e0_p9NOT.js";
import * as Effect from "effect/Effect";

//#region src/remix.ts
const createUploadthing = (opts) => createBuilder(opts);
const createRouteHandler = (opts) => {
	const handler = makeAdapterHandler((args) => Effect.succeed({ event: args }), (args) => Effect.succeed(args.request), opts, "remix");
	return {
		action: handler,
		loader: handler
	};
};

//#endregion
export { UTFiles, createRouteHandler, createUploadthing, UTRegion as experimental_UTRegion };
//# sourceMappingURL=index.js.map