/**
 * Profile API endpoint
 * GET: Retrieve user profile
 * PATCH: Update user profile
 */
import { NextResponse } from "next/server";
import { query } from "../../../lib/db";
import { getUser } from "../../../lib/auth";

export interface Profile {
  id: string;
  userId: string;
  businessName: string | null;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  website: string | null;
  defaultCurrency: string;
  preferredPdfTemplate: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileResponse {
  success: boolean;
  message?: string;
  profile?: Profile;
}

export interface ProfileUpdateRequest {
  businessName?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  website?: string;
  defaultCurrency?: string;
  preferredPdfTemplate?: string;
}

/**
 * GET handler - retrieve user profile
 */
export async function GET(): Promise<NextResponse> {
  try {
    // Get current user from session
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user profile
    const result = await query<Record<string, unknown>>(
      `SELECT id, user_id as "userId", business_name as "businessName",
              logo_url as "logoUrl", phone, email, address, tax_id as "taxId", website,
              default_currency as "defaultCurrency", preferred_pdf_template as "preferredPdfTemplate",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM user_profiles
       WHERE user_id = $1`,
      [user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: result.rows[0],
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH handler - update user profile
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    // Get current user from session
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body: ProfileUpdateRequest = await request.json();

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (body.businessName !== undefined) {
      updates.push(`business_name = $${paramIndex++}`);
      values.push(body.businessName);
    }

    if (body.phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(body.phone);
    }

    if (body.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(body.email);
    }

    if (body.address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      values.push(body.address);
    }

    if (body.taxId !== undefined) {
      updates.push(`tax_id = $${paramIndex++}`);
      values.push(body.taxId);
    }

    if (body.website !== undefined) {
      updates.push(`website = $${paramIndex++}`);
      values.push(body.website);
    }

    if (body.defaultCurrency !== undefined) {
      updates.push(`default_currency = $${paramIndex++}`);
      values.push(body.defaultCurrency);
    }

    if (body.preferredPdfTemplate !== undefined) {
      updates.push(`preferred_pdf_template = $${paramIndex++}`);
      values.push(body.preferredPdfTemplate);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, message: "No fields to update" },
        { status: 400 }
      );
    }

    // Add updated_at and user_id
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date().toISOString());
    values.push(user.id);

    // Execute update
    const result = await query<Record<string, unknown>>(
      `UPDATE user_profiles
       SET ${updates.join(", ")}
       WHERE user_id = $${paramIndex}
       RETURNING id, user_id as "userId", business_name as "businessName",
                 logo_url as "logoUrl", phone, email, address, tax_id as "taxId", website,
                 default_currency as "defaultCurrency", preferred_pdf_template as "preferredPdfTemplate",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      profile: result.rows[0],
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
