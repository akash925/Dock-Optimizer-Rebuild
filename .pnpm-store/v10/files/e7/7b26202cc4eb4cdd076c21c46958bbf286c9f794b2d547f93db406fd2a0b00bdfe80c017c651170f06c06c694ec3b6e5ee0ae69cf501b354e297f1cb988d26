import "../dist/package-Beb-iarE.js";
import "../dist/deprecations-pLmw6Ytd.js";
import "../dist/shared-schemas-BIFDoqPF.js";
import { UTFiles$1 as UTFiles, UTRegion$1 as UTRegion, createBuilder, makeAdapterHandler } from "../dist/upload-builder-e0_p9NOT.js";
import { toWebRequest } from "../dist/to-web-request-DhP0wXG-.js";
import * as Effect from "effect/Effect";

//#region src/next-legacy.ts
const createUploadthing = (opts) => createBuilder(opts);
const createRouteHandler = (opts) => {
	const handler = makeAdapterHandler((req, res) => Effect.succeed({
		req,
		res
	}), (req) => toWebRequest(req), opts, "nextjs-pages");
	return async (req, res) => {
		const response = await handler(req, res);
		res.status(response.status);
		for (const [name, value] of response.headers) res.setHeader(name, value);
		return res.json(await response.json());
	};
};

//#endregion
export { UTFiles, createRouteHandler, createUploadthing, UTRegion as experimental_UTRegion };
//# sourceMappingURL=index.js.map