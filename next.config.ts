import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Heavy file parsers used inside the import Workflow steps. Keeping them as
  // external server packages avoids bundling native/CJS edge cases.
  serverExternalPackages: ["mammoth", "read-excel-file"],
};

// withWorkflow enables the "use workflow" / "use step" directives and wires the
// Workflow DevKit's internal routes for durable, resumable execution on Vercel.
export default withWorkflow(nextConfig);
