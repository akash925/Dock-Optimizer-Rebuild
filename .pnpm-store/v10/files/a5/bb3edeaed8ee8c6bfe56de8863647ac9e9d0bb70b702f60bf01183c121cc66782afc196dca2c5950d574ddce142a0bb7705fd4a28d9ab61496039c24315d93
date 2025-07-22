import "../dist/package-Beb-iarE.js";
import "../dist/deprecations-pLmw6Ytd.js";
import "../dist/shared-schemas-BIFDoqPF.js";
import { AdapterArguments, UTFiles$1 as UTFiles, UTRegion$1 as UTRegion, configProvider, createBuilder, createRequestHandler } from "../dist/upload-builder-e0_p9NOT.js";
import * as Effect from "effect/Effect";
import * as HttpRouter from "@effect/platform/HttpRouter";
import * as HttpServerRequest from "@effect/platform/HttpServerRequest";
import * as Layer from "effect/Layer";

//#region src/effect-platform.ts
const createUploadthing = (opts) => createBuilder(opts);
const createRouteHandler = (opts) => {
	const router = Effect.runSync(createRequestHandler(opts, "effect-platform"));
	return HttpRouter.provideServiceEffect(router, AdapterArguments, Effect.map(HttpServerRequest.HttpServerRequest, (serverRequest) => ({ req: serverRequest }))).pipe(Effect.provide(Layer.setConfigProvider(configProvider(opts.config))));
};

//#endregion
export { UTFiles, createRouteHandler, createUploadthing, UTRegion as experimental_UTRegion };
//# sourceMappingURL=index.js.map