import { Request, Response } from "express";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { bookingPages } from "@shared/schema";

// Fetch booking styles for a specific booking page
export const getBookingStyles = async (req: Request, res: Response) => {
  try {
    const { slug } = req.query;
    
    if (!slug) {
      return res.status(400).json({ error: "Booking page slug is required" });
    }
    
    // Find the booking page by slug
    const [page] = await db
      .select()
      .from(bookingPages)
      .where(eq(bookingPages.slug, String(slug)));
    
    if (!page) {
      return res.status(404).json({ error: "Booking page not found" });
    }
    
    // Extract style settings from the booking page
    // Note: In a real implementation, these would be stored in the database
    // For now, we'll return some default styles based on the primary color
    
    const baseStyles = {
      primaryColor: page.primaryColor || "#4CAF50",
      secondaryColor: "#2196F3",
      accentColor: "#FF9800",
      backgroundColor: "#ffffff",
      textColor: "#333333",
      fontFamily: "system-ui, -apple-system, sans-serif",
      buttonStyle: "rounded",
      progressHeight: 6,
      borderRadius: 8,
      headerFontSize: "24px",
      subheaderFontSize: "18px",
      bodyFontSize: "16px",
      pageMaxWidth: "600px",
      pagePadding: "2rem",
      sectionMarginBottom: "2rem",
      fieldMarginBottom: "1.5rem",
      // Add any other style settings
    };
    
    return res.status(200).json(baseStyles);
  } catch (error) {
    console.error("Error fetching booking styles:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};