import { z } from 'zod';

/**
 * Single Zod Schema for Product Pricing Validation
 * Handles conditional "Fixed vs Negotiable" pricing rules:
 *
 * 1. FIXED Price Policy:
 *    - `maxPrice` must be >= `costPrice`
 *    - Automatically normalizes `minPrice = maxPrice`
 *
 * 2. NEGOTIABLE Price Policy:
 *    - Requires `costPrice`, `minPrice` (Min Selling Price), and `maxPrice` (Max Selling Price)
 *    - `minPrice` >= `costPrice`
 *    - `maxPrice` > `minPrice`
 *    - `maxPrice` is the product's negotiable ceiling
 */
export const productPricingSchema = z
  .object({
    pricingPolicy: z.enum(['FIXED', 'NEGOTIABLE'], {
      message: 'Pricing policy must be either FIXED or NEGOTIABLE.',
    }),
    costPrice: z
      .number({
        message: 'Cost Price is required and must be a valid number.',
      })
      .finite('Cost Price must be a valid number.')
      .min(0, 'Cost Price cannot be negative.'),
    // Legacy request compatibility: new product writes use maxPrice only.
    sellingPrice: z
      .number({
        message: 'Price is required and must be a valid number.',
      })
      .finite('Price must be a valid number.')
      .optional(),
    minPrice: z
      .number({
        message: 'Min Selling Price is required and must be a valid number.',
      })
      .finite('Min Selling Price must be a valid number.')
      .optional(),
    maxPrice: z
      .number({
        message: 'Max Selling Price is required and must be a valid number.',
      })
      .finite('Max Selling Price must be a valid number.')
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.pricingPolicy === 'FIXED') {
      const fixedPrice = data.maxPrice ?? data.sellingPrice;
      if (fixedPrice === undefined || fixedPrice === null || Number.isNaN(fixedPrice)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['maxPrice'],
          message: 'Price is required for Fixed Price policy.',
        });
        return;
      }

      if (fixedPrice <= 0 && data.costPrice > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['maxPrice'],
          message: 'Selling Price must be greater than zero.',
        });
      }

      if (fixedPrice < data.costPrice) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['maxPrice'],
          message: `Maximum Price (${fixedPrice}) must be greater than or equal to Cost Price (${data.costPrice}).`,
        });
      }
    } else if (data.pricingPolicy === 'NEGOTIABLE') {
      const hasMin = data.minPrice !== undefined && data.minPrice !== null && !Number.isNaN(data.minPrice);
      const hasMax = data.maxPrice !== undefined && data.maxPrice !== null && !Number.isNaN(data.maxPrice);

      if (!hasMin) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['minPrice'],
          message: 'Minimum Selling Price is required for Negotiable Price policy.',
        });
      }

      if (!hasMax) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['maxPrice'],
          message: 'Maximum Selling Price is required for Negotiable Price policy.',
        });
      }

      if (hasMin && data.minPrice! < data.costPrice) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['minPrice'],
          message: `Minimum Selling Price (${data.minPrice}) must be greater than or equal to Cost Price (${data.costPrice}).`,
        });
      }

      if (hasMin && hasMax && Math.round(data.maxPrice!) <= Math.round(data.minPrice!)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['maxPrice'],
          message: `Tag Price (${data.maxPrice}) must be greater than Minimum Selling Price (${data.minPrice}) for negotiable pricing.`,
        });
      }
    }
  })
  .transform((data) => {
    const costPrice = Math.round(data.costPrice);
    if (data.pricingPolicy === 'FIXED') {
      const price = Math.round(data.maxPrice ?? data.sellingPrice!);
      // Fixed Price Policy Rule: minPrice = maxPrice
      return {
        costPrice,
        sellingPrice: price,
        minPrice: price,
        maxPrice: price,
      };
    } else {
      const minPrice = Math.round(data.minPrice!);
      const maxPrice = Math.round(data.maxPrice!);
      // Negotiable Price Policy Rule: sellingPrice defaults to maxPrice (tag price)
      return {
        costPrice,
        sellingPrice: maxPrice,
        minPrice,
        maxPrice,
      };
    }
  });

export type PricingPolicy = 'FIXED' | 'NEGOTIABLE';
export type ValidatedProductPricing = z.output<typeof productPricingSchema>;

/**
 * Helper to validate and normalize product pricing with field-level and summary errors.
 */
export function validateAndNormalizeProductPricing(input: {
  pricingPolicy: PricingPolicy;
  costPrice: number | string | undefined | null;
  sellingPrice?: number | string | undefined | null;
  minPrice?: number | string | undefined | null;
  maxPrice?: number | string | undefined | null;
}): {
  success: boolean;
  data?: ValidatedProductPricing;
  error?: string;
  fieldErrors: {
    costPrice?: string;
    sellingPrice?: string;
    minPrice?: string;
    maxPrice?: string;
    general?: string;
  };
  errors: {
    costPrice?: string;
    sellingPrice?: string;
    minPrice?: string;
    maxPrice?: string;
    general?: string;
  };
} {
  const parseNum = (val: number | string | undefined | null): number | undefined => {
    if (val === undefined || val === null || String(val).trim() === '') return undefined;
    const n = Number(val);
    return Number.isFinite(n) ? n : NaN;
  };

  const rawCost = parseNum(input.costPrice);
  const rawSelling = parseNum(input.sellingPrice);
  const rawMin = parseNum(input.minPrice);
  const rawMax = parseNum(input.maxPrice);

  const result = productPricingSchema.safeParse({
    pricingPolicy: input.pricingPolicy,
    costPrice: rawCost,
    sellingPrice: rawSelling,
    minPrice: rawMin,
    maxPrice: rawMax,
  });

  if (result.success) {
    return {
      success: true,
      data: result.data,
      fieldErrors: {},
      errors: {},
    };
  }

  const errors: {
    costPrice?: string;
    sellingPrice?: string;
    minPrice?: string;
    maxPrice?: string;
    general?: string;
  } = {};

  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof typeof errors | undefined;
    if (field && !errors[field]) {
      errors[field] = issue.message;
    }
    if (!errors.general) {
      errors.general = issue.message;
    }
  }

  return {
    success: false,
    error: errors.general || 'Invalid product pricing.',
    fieldErrors: errors,
    errors,
  };
}

/**
 * Zod Schema for Product Brand validation.
 * Brand is validated and stored as a plain text string rather than a relational ID.
 */
export const productBrandSchema = z
  .string({
    message: 'Brand must be a text string.',
  })
  .trim()
  .min(1, 'Brand is required.')
  .max(100, 'Brand name cannot exceed 100 characters.');

export function validateProductBrand(brand: unknown): {
  success: boolean;
  brand: string;
  error?: string;
} {
  const result = productBrandSchema.safeParse(brand);
  if (result.success) {
    return { success: true, brand: result.data };
  }
  return {
    success: false,
    brand: typeof brand === 'string' && brand.trim() ? brand.trim() : 'Local',
    error: result.error.issues[0]?.message || 'Invalid brand text.',
  };
}
