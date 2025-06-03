import { Express } from "express";
import facilityRoutes from "./routes";

export default {
  initialize: (app: Express) => {
    console.log("Initializing Facility Management module...");
    app.use("/api", facilityRoutes);
    console.log("Facility Management module loaded successfully");
  }
};