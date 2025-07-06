import { Router } from "express";
import { 
  // Legacy asset endpoints
  listAssets, 
  getAssetById, 
  uploadAsset, 
  updateAsset, 
  deleteAsset,
  // Company asset endpoints
  listCompanyAssets,
  getCompanyAssetById,
  createCompanyAsset,
  updateCompanyAsset,
  deleteCompanyAsset,
  // Photo upload endpoints
  getPresignAssetPhoto, 
  updatePhotoKey 
} from "./controllers";
import { isAuthenticated } from "../../middleware/auth";
import express from "express";

// TODO(fix-asset-routing): ensure companyAssetsRouter is exported correctly
// Legacy routes for backward compatibility (/api/assets)
const legacyRouter = Router();

// Legacy asset routes (backward compatibility)
legacyRouter.get("/assets", isAuthenticated, listAssets);
legacyRouter.get("/assets/:id", isAuthenticated, getAssetById);
legacyRouter.post("/assets", isAuthenticated, uploadAsset);
legacyRouter.put("/assets/:id", isAuthenticated, updateAsset);
legacyRouter.delete("/assets/:id", isAuthenticated, deleteAsset);

// Company Assets Router - main functionality
const companyAssetsRouter = Router();

// Company asset CRUD operations
companyAssetsRouter.get("/", isAuthenticated, listCompanyAssets);
companyAssetsRouter.get("/:id", isAuthenticated, getCompanyAssetById);
companyAssetsRouter.post("/", isAuthenticated, createCompanyAsset);
companyAssetsRouter.put("/:id", isAuthenticated, updateCompanyAsset);
companyAssetsRouter.delete("/:id", isAuthenticated, deleteCompanyAsset);

// Photo upload endpoints
companyAssetsRouter.post("/:id/photo/presign", isAuthenticated, getPresignAssetPhoto);
companyAssetsRouter.put("/:id/photo", isAuthenticated, updatePhotoKey);

// Setup static file serving function
export function setupStaticFileServing(app: express.Express): void {
  // Setup static file serving for asset images if needed
  // This can be expanded based on requirements
  console.log('Static file serving for company assets configured');
}

// Export the company assets router
export { companyAssetsRouter };

// Export legacy routes as default for backward compatibility
export default legacyRouter;