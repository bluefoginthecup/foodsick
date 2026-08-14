import path from "node:path";
import { startProdServer } from "vinext/server/prod-server";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);

await startProdServer({
  port,
  host: "0.0.0.0",
  outDir: path.resolve(process.cwd(), "dist"),
});
