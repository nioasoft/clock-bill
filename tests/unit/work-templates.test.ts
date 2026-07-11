import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createWorkTemplateSchema } from "../../lib/schemas/work-templates";

const valid = createWorkTemplateSchema.safeParse({
  clientId: "c1", projectId: "p1", title: "Weekly review", description: "Review",
  billingKind: "hourly", duration: 60, isBillable: true,
});
if (!valid.success) throw new Error("valid template rejected");
if (createWorkTemplateSchema.safeParse({ ...valid.data, title: "" }).success) throw new Error("empty title accepted");

const listSource = readFileSync(join(process.cwd(), "app/api/work-templates/route.ts"), "utf8");
const deleteSource = readFileSync(join(process.cwd(), "app/api/work-templates/[id]/route.ts"), "utf8");
if (!listSource.includes("getUser()") || !deleteSource.includes("getUser()")) throw new Error("auth missing");
if ((listSource.match(/user_id = \$1/g) ?? []).length < 3) throw new Error("tenant scoping missing");
if (!deleteSource.includes("user_id = $2")) throw new Error("delete ownership missing");
if (!listSource.includes("LIMIT 50")) throw new Error("list limit missing");
if (!listSource.includes("parseBody(request, createWorkTemplateSchema)")) throw new Error("shared body validation missing");
if (!listSource.includes("work-templates-write") || !deleteSource.includes("work-templates-write")) throw new Error("write rate limit missing");
if (!deleteSource.includes("z.string().uuid()")) throw new Error("template id validation missing");
console.log("✅ work-templates: schema and tenant contracts pass");
