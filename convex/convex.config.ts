import { defineApp } from "convex/server";
import rag from "@convex-dev/rag/convex.config";
import agent from "@convex-dev/agent/convex.config";
import polar from "@convex-dev/polar/convex.config";
import dodopayments from "@dodopayments/convex/convex.config";

const app = defineApp();
app.use(rag);
app.use(agent);
app.use(polar);
app.use(dodopayments);

export default app;
