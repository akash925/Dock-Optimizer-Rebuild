import { Router } from "express";
import { getPresignAssetPhoto, updatePhotoKey } from "./controllers";
import { isAuthenticated } from "../../middleware/auth";

const r = Router();

/** POST /api/company-assets/:id/photo/presign */
r.post("/:id/photo/presign", isAuthenticated, getPresignAssetPhoto);

/** Callback used by front-end after successful PUT to S3 */
r.put("/:id/photo", isAuthenticated, updatePhotoKey);

export default r;